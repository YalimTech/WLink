import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { BaseAdapter, NotFoundError, IntegrationError } from '../core/base-adapter';
import { GhlTransformer } from './ghl.transformer';
import { PrismaService, parseId } from '../prisma/prisma.service';
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

  // --- Manejo del cliente HTTP de GoHighLevel (con refresco de token) ---
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
        if (error.response?.status === 401 && originalRequest && !originalRequest.headers['_retry']) {
          originalRequest.headers['_retry'] = true;
          try {
            const userForRetry = await this.prisma.getUserWithTokens(ghlUserId);
            if (!userForRetry?.refreshToken) throw new Error("No refresh token available");

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
            throw new HttpException(`Token refresh failed. Re-authorize.`, HttpStatus.UNAUTHORIZED);
          }
        }
        return Promise.reject(error);
      },
    );
    return httpClient;
  }

  private async refreshGhlAccessToken(refreshToken: string): Promise<any> {
    const clientId = this.configService.get<string>('GHL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GHL_CLIENT_SECRET');
    const response = await axios.post(`${this.ghlApiBaseUrl}/oauth/token`, new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      user_type: "Location",
    }));
    return response.data;
  }
  
  // --- Lógica de Contactos ---
  async getGhlContactByPhone(locationId: string, phone: string): Promise<GhlContact | null> {
    const httpClient = await this.getHttpClient(locationId);
    try {
        const response = await httpClient.get(`/contacts/lookup?phone=${encodeURIComponent(phone)}`);
        return (response.data?.contacts?.[0]) || null;
    } catch (error) {
        if ((error as AxiosError).response?.status === 404) return null;
        this.logger.error(`Error fetching contact by phone in GHL: ${error.message}`);
        throw error;
    }
  }

  private async findOrCreateGhlContact(
    locationId: string,
    phone: string,
    name: string,
    instanceId: string,
  ): Promise<GhlContact> {
    const httpClient = await this.getHttpClient(locationId);
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const tag = `whatsapp-instance-${instanceId}`;

    // Primero, intenta buscar el contacto
    let contact = await this.getGhlContactByPhone(locationId, formattedPhone);

    if (contact) {
      // Si el contacto existe y no tiene la etiqueta, la añadimos
      if (!contact.tags.includes(tag)) {
        this.logger.log(`Contact ${contact.id} found, adding instance tag: ${tag}`);
        await httpClient.put(`/contacts/${contact.id}`, {
          tags: [...contact.tags, tag],
        });
      }
      return contact;
    } else {
      // Si no existe, lo creamos con la etiqueta desde el principio
      this.logger.log(`Contact not found, creating new one for phone ${formattedPhone} with tag ${tag}`);
      const createPayload: GhlContactUpsertRequest = {
        locationId,
        name: name || `WhatsApp User ${formattedPhone.slice(-4)}`,
        phone: formattedPhone,
        tags: [tag, 'whatsapp-created'],
        source: 'EvolutionAPI',
      };
      const response = await httpClient.post('/contacts/', createPayload);
      return response.data.contact;
    }
  }

  // --- Lógica de Webhooks ---
  async handlePlatformWebhook(ghlWebhook: GhlWebhookDto, instanceId: string): Promise<void> {
    this.logger.log(`Handling Outbound GHL Webhook for Instance ${instanceId}`);
    const instance = await this.prisma.instance.findUnique({ where: { idInstance: parseId(instanceId) } });

    if (!instance) throw new NotFoundError(`Instance ${instanceId} not found`);
    if (instance.stateInstance !== 'authorized') throw new IntegrationError('Instance is not authorized');
    if (!ghlWebhook.phone) throw new IntegrationError('Missing phone number to send message');

    // Aquí se utiliza el EvolutionService para enviar el mensaje
    await this.evolutionService.sendMessage(
      instance.apiTokenInstance,
      ghlWebhook.phone,
      ghlWebhook.message,
    );
    await this.updateGhlMessageStatus(ghlWebhook.locationId, ghlWebhook.messageId, 'delivered');
  }

  async handleEvolutionWebhook(webhook: EvolutionWebhook, instanceId: string): Promise<void> {
    this.logger.log(`Handling Inbound Evolution Webhook for Instance ${instanceId}`);
    const instance = await this.prisma.instance.findUnique({ where: { idInstance: parseId(instanceId) } });

    if (!instance) throw new NotFoundError(`Webhook for unknown instance ${instanceId}. Ignoring.`);
    
    // Solo procesamos mensajes nuevos
    if (webhook.event === 'messages.upsert' && webhook.data?.key?.remoteJid) {
      const messageData = webhook.data;
      const senderJid = messageData.key.remoteJid;
      const senderPhone = senderJid.split('@')[0];
      const senderName = messageData.pushName || `WhatsApp User ${senderPhone.slice(-4)}`;

      // 1. Encuentra o crea el contacto en GHL y lo etiqueta
      const ghlContact = await this.findOrCreateGhlContact(
        instance.userId,
        senderPhone,
        senderName,
        instance.idInstance,
      );
      if (!ghlContact?.id) throw new Error('Failed to resolve GHL contact.');

      // 2. Transforma el mensaje al formato de GHL
      const transformedMsg = this.ghlTransformer.toPlatformMessage(webhook);
      transformedMsg.contactId = ghlContact.id; // Asignamos el ID real
      transformedMsg.locationId = instance.userId;

      // 3. Envía el mensaje a GHL
      await this.postInboundMessageToGhl(instance.userId, transformedMsg);
    }
  }

  // --- Lógica de Mensajería y Estado ---
  async updateGhlMessageStatus(
    locationId: string,
    messageId: string,
    status: 'delivered' | 'read' | 'failed' | 'sent',
    meta: Partial<MessageStatusPayload> = {},
  ): Promise<void> {
    const httpClient = await this.getHttpClient(locationId);
    await httpClient.put(`/conversations/messages/${messageId}/status`, { status, ...meta });
    this.logger.debug(`Updated status of message ${messageId} to ${status}`);
  }

  async postInboundMessageToGhl(locationId: string, message: GhlPlatformMessage): Promise<void> {
    const httpClient = await this.getHttpClient(locationId);
    let conversation = (await httpClient.get(`/conversations/search?locationId=${locationId}&contactId=${message.contactId}`)).data.conversations?.[0];

    if (!conversation) {
      conversation = (await httpClient.post(`/conversations/`, { locationId, contactId: message.contactId })).data.conversation;
    }

    const payload = {
      type: 'Custom',
      conversationId: conversation.id,
      message: message.message,
      direction: 'inbound',
      conversationProviderId: this.configService.get<string>('GHL_CONVERSATION_PROVIDER_ID'),
      attachments: message.attachments?.map((att) => att.url),
    };
    
    await httpClient.post(`/conversations/messages/inbound`, payload);
    this.logger.log(`Posted inbound message to GHL conversation ${conversation.id}`);
  }

  // --- Lógica de Creación de Instancias ---
  async createEvolutionApiInstanceForUser(
    userId: string,
    instanceId: string,
    apiToken: string,
    name?: string,
  ): Promise<Instance> {
    const existing = await this.prisma.instance.findUnique({ where: { idInstance: parseId(instanceId) } });
    if (existing) throw new HttpException('Instance with this ID already exists', HttpStatus.CONFLICT);

    // Validar credenciales con Evolution API
    try {
      const status = await this.evolutionService.getInstanceStatus(apiToken);
      if (status.instance.instanceName !== instanceId) {
        throw new Error("Instance ID mismatch");
      }
    } catch (err) {
      this.logger.error(`Evolution API credentials invalid: ${err.message}`);
      throw new HttpException('Invalid Evolution API credentials', HttpStatus.BAD_REQUEST);
    }
    
    const newInstance = await this.prisma.instance.create({
      data: {
        idInstance: parseId(instanceId),
        apiTokenInstance: apiToken,
        userId,
        name: name || `Evolution ${instanceId.substring(0, 8)}`,
        stateInstance: 'authorized', // Asumimos autorizado si la verificación fue exitosa
        settings: {},
      },
    });

    // Configurar el webhook en Evolution API
    const webhookUrl = `${this.configService.get<string>('APP_URL')}/webhooks/evolution`;
    try {
      await this.evolutionService.configureWebhooks(apiToken, webhookUrl);
      this.logger.log(`Evolution API webhooks configured for instance ${instanceId}`);
    } catch (err) {
      this.logger.error(`Failed to configure Evolution API webhooks for instance ${instanceId}`, err);
    }

    this.logger.log(`New Evolution API instance created for user ${userId}: ${instanceId}`);
    return newInstance as unknown as Instance;
  }
}

