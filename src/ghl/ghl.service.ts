// Parte 1 - Importaciones y definición inicial de la clase
import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  BaseAdapter,
  NotFoundError,
  IntegrationError,
} from '../core/base-adapter';
import { GhlTransformer } from './ghl.transformer';
import { PrismaService } from '../prisma/prisma.service';
import { EvolutionService } from '../evolution/evolution.service';
import { GhlWebhookDto } from './dto/ghl-webhook.dto';
import {
  GhlContact,
  GhlContactUpsertRequest,
  GhlPlatformMessage,
  MessageStatusPayload,
  SendResponse,
  User,
  Instance,
  InstanceState,
} from '../types';
import { EvolutionWebhook } from '../types/evolution-webhook.interface';

@Injectable()
export class GhlService extends BaseAdapter<
  GhlPlatformMessage,
  EvolutionWebhook,
  User,
  Instance
> {
  private readonly ghlApiBaseUrl = 'https://services.leadconnectorhq.com';
  private readonly ghlApiVersion = '2021-07-28';

  constructor(
    protected readonly ghlTransformer: GhlTransformer,
    protected readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly evolutionService: EvolutionService,
  ) {
    super(ghlTransformer, prisma);
  }


  // Parte 2 - Método getHttpClient (gestión de tokens y cliente Axios con retry)
  
    private async getHttpClient(ghlUserId: string): Promise<AxiosInstance> {
    const userWithTokens = await this.prisma.getUserWithTokens(ghlUserId);
    if (
      !userWithTokens ||
      !userWithTokens.accessToken ||
      !userWithTokens.refreshToken
    ) {
      this.logger.error(`No tokens found for GHL User (Location ID): ${ghlUserId}`);
      throw new HttpException(
        `GHL auth tokens not found for User ${ghlUserId}. Re-authorize.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    let currentAccessToken = userWithTokens.accessToken;

    const willExpireSoon =
      userWithTokens.tokenExpiresAt &&
      new Date(userWithTokens.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;

    if (willExpireSoon) {
      this.logger.log(`Access token about to expire for User ${ghlUserId}. Refreshing...`);
      try {
        const newTokens = await this.refreshGhlAccessToken(userWithTokens.refreshToken);
        await this.prisma.updateUserTokens(
          ghlUserId,
          newTokens.access_token,
          newTokens.refresh_token,
          new Date(Date.now() + newTokens.expires_in * 1000),
        );
        currentAccessToken = newTokens.access_token;
        this.logger.log(`Token refreshed for User ${ghlUserId}`);
      } catch (err) {
        this.logger.error(`Token refresh failed for User ${ghlUserId}: ${err.message}`);
        throw new HttpException(
          `Unable to refresh GHL token for User ${ghlUserId}.`,
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    const httpClient = axios.create({
      baseURL: this.ghlApiBaseUrl,
      headers: {
        Authorization: `Bearer ${currentAccessToken}`,
        Version: this.ghlApiVersion,
        'Content-Type': 'application/json',
      },
    });

    httpClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;
        const userForRetry = await this.prisma.getUserWithTokens(ghlUserId);
        if (!userForRetry?.refreshToken) {
          this.logger.error(`User ${ghlUserId} or refresh token disappeared during retry.`);
          throw error;
        }

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest.headers['_retry']
        ) {
          originalRequest.headers['_retry'] = true;
          try {
            const newTokens = await this.refreshGhlAccessToken(userForRetry.refreshToken);
            await this.prisma.updateUserTokens(
              ghlUserId,
              newTokens.access_token,
              newTokens.refresh_token,
              new Date(Date.now() + newTokens.expires_in * 1000),
            );
            originalRequest.headers['Authorization'] = `Bearer ${newTokens.access_token}`;
            return httpClient(originalRequest);
          } catch (refreshError) {
            this.logger.error(`Retry token refresh failed: ${refreshError.message}`);
            throw new HttpException(
              `Token refresh failed. Re-authorize.`,
              HttpStatus.UNAUTHORIZED,
            );
          }
        }

        const status = error.response?.status;
        const data = error.response?.data;
        this.logger.error(
          `GHL API error [${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}] - ${status}: ${JSON.stringify(data)}`,
        );
        throw new HttpException(
          (data as any)?.message || 'GHL API request failed',
          status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      },
    );

    return httpClient;
  }

  private async refreshGhlAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const clientId = this.configService.get<string>('GHL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GHL_CLIENT_SECRET');

    const response = await axios.post('https://services.leadconnectorhq.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    return response.data;
  }

  // Parte 3 - Método refreshGhlAccessToken (renovación de tokens GHL)
  
    async findOrCreateGhlContact(locationId: string, phone: string): Promise<GhlContact> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      const response = await httpClient.get(`/contacts/lookup?phone=${phone}`);
      return response.data.contact as GhlContact;
    } catch (error) {
      this.logger.warn(`Contact not found by phone in GHL. Creating new one...`);
      const contactPayload: GhlContactUpsertRequest = {
        locationId,
        contact: {
          phone,
          name: `User ${phone.slice(-4)}`,
          tags: ['whatsapp-created'],
          customField: {},
        },
      };

      const httpClient = await this.getHttpClient(locationId);
      const createResponse = await httpClient.post('/contacts/upsert', contactPayload);
      return createResponse.data.contact;
    }
  }

  async getGhlContact(locationId: string, contactId: string): Promise<GhlContact | null> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      const response = await httpClient.get(`/contacts/${contactId}`);
      return response.data.contact as GhlContact;
    } catch (error) {
      this.logger.error(`Failed to fetch contact ${contactId} in GHL: ${error.message}`);
      return null;
    }
  }

  async getGhlContactByPhone(locationId: string, phone: string): Promise<GhlContact> {
    return this.findOrCreateGhlContact(locationId, phone);
  }



  // Parte 4 - Gestión de contactos GHL (findOrCreate, getById, getByPhone)

    async updateGhlMessageStatus(
    locationId: string,
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    meta: Partial<MessageStatusPayload> = {},
  ): Promise<void> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      await httpClient.put(`/conversations/messages/status/${messageId}`, {
        status,
        ...meta,
      });
      this.logger.debug(`Updated status of message ${messageId} to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update status of message ${messageId}: ${error.message}`);
    }
  }

  async postInboundMessageToGhl(locationId: string, message: GhlPlatformMessage): Promise<SendResponse> {
    const httpClient = await this.getHttpClient(locationId);
    try {
      const response = await httpClient.post('/conversations/messages/inbound', message);
      return response.data as SendResponse;
    } catch (error) {
      this.logger.error(`Failed to post inbound message to GHL: ${error.message}`);
      throw new IntegrationError('Failed to post inbound message to GHL');
    }
  }

  // Alias para compatibilidad
  async sendInboundMessageToGhl(payload: {
    locationId: string;
    message: GhlPlatformMessage;
  }): Promise<SendResponse> {
    return this.postInboundMessageToGhl(payload.locationId, payload.message);
  }


  // Parte 5 - Estado y mensajes (updateMessageStatus, inbound message, envío general)

    async createPlatformClient(locationId: string): Promise<HttpService> {
    const accessToken = await this.getAccessToken(locationId);
    return new HttpService(
      axios.create({
        baseURL: this.ghlApiBaseUrl,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: this.ghlApiVersion,
        },
      }),
    );
  }

  async sendToPlatform(locationId: string, message: GhlPlatformMessage): Promise<SendResponse> {
    const client = await this.createPlatformClient(locationId);
    try {
      const response = await firstValueFrom(
        client.post("/conversations/messages/send", message),
      );
      return response.data as SendResponse;
    } catch (error) {
      this.logger.error(`Error sending message to GHL platform: ${error.message}`);
      throw new IntegrationError("Failed to send message to GHL");
    }
  }

  async getInstanceByUserId(userId: string): Promise<Instance | null> {
    const instances = await this.prisma.getInstancesByUserId(userId);
    if (!instances || instances.length === 0) return null;
    const sorted = instances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return sorted[0];
  }


  // Parte 6 - Webhooks: desde GHL y desde Evolution API

    async handlePlatformWebhook(
    ghlWebhook: GhlWebhookDto,
    instanceId: string | number,
  ): Promise<void> {
    try {
      const message: GhlPlatformMessage = {
        direction: "outbound",
        locationId: ghlWebhook.locationId,
        message: ghlWebhook.message,
        phone: ghlWebhook.phone,
        type: ghlWebhook.type,
        attachments: ghlWebhook.attachments?.map((url) => ({ url })),
        messageId: ghlWebhook.messageId,
      };

      const inst = await this.prisma.instance.findUnique({
        where: { idInstance: instanceId.toString() },
      });

      if (!inst) {
        throw new NotFoundError(`Instance ${instanceId} not found`);
      }

      if (!message.phone) {
        throw new IntegrationError("Missing phone number to send message");
      }

      await this.evolutionService.sendMessage(
        inst.apiTokenInstance,
        message.phone,
        message.message,
      );
    } catch (error) {
      this.logger.error(`Failed to handle outbound message webhook: ${error.message}`, error);
      throw new Error("Failed to forward outbound message to Evolution API");
    }
  }

  async handleEvolutionWebhook(webhook: EvolutionWebhook): Promise<void> {
    const idInstance = webhook.instanceId?.toString();

    const instance = await this.prisma.instance.findFirst({
      where: { idInstance },
    });

    if (!instance) {
      this.logger.error(`No instance found for ID ${webhook.instanceId}`);
      return;
    }

    const locationId = instance.userId;

    const inbound: GhlPlatformMessage = {
      direction: "inbound",
      locationId,
      phone: webhook.messageData?.senderData.chatId.replace("@c.us", ""),
      message: webhook.messageData?.textMessageData?.textMessage || "",
      messageId: webhook.messageData?.idMessage,
      type: webhook.messageData?.typeMessage,
    };

    await this.postInboundMessageToGhl(locationId, inbound);
  }
  

// Parte 7 - Gestión de estado e instancias (crear, actualizar, manejar state webhooks)
  
    async updateInstanceState(
    instanceId: string | number,
    newState: InstanceState | string,
  ): Promise<void> {
    try {
      await this.prisma.instance.update({
        where: { idInstance: instanceId.toString() },
        data: {
          stateInstance: newState as InstanceState,
        },
      });
      this.logger.log(`Instance ${instanceId} state updated to ${newState}`);
    } catch (error) {
      this.logger.error(`Failed to update state of instance ${instanceId}: ${error.message}`);
    }
  }
  
async verifyEvolutionInstance(instanceId: string, apiToken: string): Promise<boolean> {
  try {
    const status = await this.evolutionService.getInstanceStatus(apiToken);
    const returnedId =
      status?.idInstance || status?.instanceId || status?.instance_id;

    if (!returnedId || returnedId.toString() !== instanceId.toString()) {
      this.logger.warn(`Instance ID mismatch: expected ${instanceId}, got ${returnedId}`);
      return false;
    }

    return true;
  } catch (err) {
    this.logger.error(`Failed to verify Evolution API instance: ${err.message}`);
    return false;
  }
}


  // Verifica que las credenciales proporcionadas (instanceId y apiToken) sean válidas consultando el estado de la instancia en Evolution API

  
  async createEvolutionApiInstanceForUser(
    userId: string,
    instanceId: string | number,
    apiToken: string,
    wid?: string,
    name?: string,
  ): Promise<Instance> {
    const idInst = instanceId.toString();

    const existing = await this.prisma.instance.findFirst({
      where: { idInstance: idInst },
    });

    if (existing) {
      this.logger.warn(`Instance ${instanceId} already exists. Skipping creation.`);
      return existing as unknown as Instance;
    }

    try {
      const status = await this.evolutionService.getInstanceStatus(apiToken);
      const returnedId =
        status?.idInstance || status?.instanceId || status?.instance_id;
      if (returnedId && returnedId.toString() !== idInst) {
        throw new IntegrationError("Instance ID mismatch");
      }

      wid = wid || status?.wid || status?.widNumber;
    } catch (err) {
      this.logger.error(`Evolution API credentials invalid: ${err.message}`);
      throw new HttpException("Invalid Evolution API credentials", HttpStatus.BAD_REQUEST);
    }

    const newInstance = await this.prisma.instance.create({
      data: {
        idInstance: idInst,
        apiTokenInstance: apiToken,
        userId,
        name: name || `Evolution ${instanceId}`,
        stateInstance: InstanceState.authorized,
        settings: {
          wid,
        },
      },
    });

    const webhookUrl = `${this.configService.get<string>("APP_URL")}/webhooks/evolution`;

    try {
      await this.evolutionService.configureWebhooks(apiToken, webhookUrl);
      this.logger.log("Evolution API webhooks configured");
    } catch (err) {
      this.logger.error("Failed to configure Evolution API webhooks", err);
    }

    this.logger.log(
      `New Evolution API instance created for user ${userId}: ${instanceId}`,
    );

    return newInstance as unknown as Instance;
  }

  async handleStateWebhook(
    instanceId: string | number,
    newState: string,
    wid?: string,
  ): Promise<void> {
    await this.updateInstanceState(instanceId, newState as InstanceState);

    if (wid) {
      const idInst = instanceId.toString();
      const instance = await this.prisma.instance.findUnique({
        where: { idInstance: idInst },
      });

      const currentSettings = (instance?.settings || {}) as Record<string, any>;

      if (instance && currentSettings.wid !== wid) {
        await this.prisma.instance.update({
          where: { idInstance: idInst },
          data: {
            settings: {
              ...currentSettings,
              wid,
            },
          },
        });
        this.logger.log(`Instance ${instanceId} WID updated to ${wid}`);
      }
    }
  }
}

