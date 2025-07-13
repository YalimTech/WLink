import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, AxiosError } from "axios";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { BaseAdapter, NotFoundError, IntegrationError } from "../core/base-adapter";
import { GhlTransformer } from "./ghl.transformer";
import { PrismaService } from "../prisma/prisma.service";
import { GhlWebhookDto } from "./dto/ghl-webhook.dto";
import { randomBytes } from "crypto";
import {
  GhlContact,
  GhlContactUpsertRequest,
  GhlContactUpsertResponse,
  GhlPlatformMessage,
  MessageStatusPayload,
  SendResponse,
  User,
  Instance,
  InstanceState,
} from "../types";
import { EvolutionWebhook } from "../types/evolution-webhook.interface";

@Injectable()
export class GhlService extends BaseAdapter<
  GhlPlatformMessage,
  EvolutionWebhook,
  User,
  Instance
> {
  private readonly ghlApiBaseUrl = "https://services.leadconnectorhq.com";
  private readonly ghlApiVersion = "2021-07-28";

  constructor(
    protected readonly ghlTransformer: GhlTransformer,
    protected readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super(ghlTransformer, prisma);
  }

  private async getHttpClient(ghlUserId: string): Promise<AxiosInstance> {
    const userWithTokens = await this.prisma.getUserWithTokens(ghlUserId);
    if (!userWithTokens || !userWithTokens.accessToken || !userWithTokens.refreshToken) {
      this.logger.error(`No tokens found for GHL User (Location ID): ${ghlUserId}`);
      throw new HttpException(
        `GHL auth tokens not found for User ${ghlUserId}. Re-authorize.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    let currentAccessToken = userWithTokens.accessToken;

    if (
      userWithTokens.tokenExpiresAt &&
      new Date(userWithTokens.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000
    ) {
      this.logger.log(`GHL Access token for User ${ghlUserId} expiring. Refreshing...`);
      try {
        const newTokens = await this.refreshGhlAccessToken(userWithTokens.refreshToken);
        await this.prisma.updateUserTokens(
          ghlUserId,
          newTokens.access_token,
          newTokens.refresh_token,
          new Date(Date.now() + newTokens.expires_in * 1000),
        );
        currentAccessToken = newTokens.access_token;
        this.logger.log(`GHL Access token refreshed for User ${ghlUserId}`);
      } catch (error) {
        this.logger.error(`Failed to refresh GHL access token for User ${ghlUserId}: ${error.message}`);
        throw new HttpException(
          `Failed to refresh GHL token for User ${ghlUserId}. Re-authorize.`,
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    const httpClient = axios.create({
      baseURL: this.ghlApiBaseUrl,
      headers: {
        Authorization: `Bearer ${currentAccessToken}`,
        Version: this.ghlApiVersion,
        "Content-Type": "application/json",
      },
    });

    httpClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;
        const userForRetry = await this.prisma.getUserWithTokens(ghlUserId);
        if (!userForRetry?.refreshToken) {
          this.logger.error(`User ${ghlUserId} or refresh token disappeared during retry logic.`);
          throw error;
        }

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest.headers["_retry"]
        ) {
          originalRequest.headers["_retry"] = true;
          this.logger.warn(`GHL API request 401 for User ${ghlUserId}. Retrying with token refresh.`);
          try {
            const newTokens = await this.refreshGhlAccessToken(userForRetry.refreshToken);
            await this.prisma.updateUserTokens(
              ghlUserId,
              newTokens.access_token,
              newTokens.refresh_token,
              new Date(Date.now() + newTokens.expires_in * 1000),
            );
            this.logger.log(`GHL Token refreshed after 401 for User ${ghlUserId}`);
            originalRequest.headers["Authorization"] = `Bearer ${newTokens.access_token}`;
            return httpClient(originalRequest);
          } catch (refreshError) {
            this.logger.error(
              `Failed to refresh GHL token after 401 for User ${ghlUserId}: ${refreshError.message}`,
            );
            throw new HttpException(
              `GHL token refresh failed for User ${ghlUserId} after 401. Re-authorize.`,
              HttpStatus.UNAUTHORIZED,
            );
          }
        }

        const status = error.response?.status;
        const data = error.response?.data;
        this.logger.error(
          `GHL API Error: [${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}] ${status} – ${JSON.stringify(data)}`,
        );
        throw new HttpException(
          (data as any)?.message || "GHL API request failed",
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
    const clientId = this.configService.get<string>("GHL_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GHL_CLIENT_SECRET");

    const response = await axios.post("https://services.leadconnectorhq.com/oauth/token", {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    return response.data;
  }

  async findOrCreateGhlContact(locationId: string, phone: string): Promise<GhlContact> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      const response = await httpClient.get(`/contacts/lookup?phone=${phone}`);
      return response.data.contact as GhlContact;
    } catch (error) {
      this.logger.warn(`Contact not found by phone. Creating new contact in GHL...`);
      const contactPayload: GhlContactUpsertRequest = {
        locationId,
        contact: {
          phone,
          name: `User ${phone.slice(-4)}`,
          tags: ["whatsapp-created"],
          customField: {},
        },
      };

      const httpClient = await this.getHttpClient(locationId);
      const createResponse = await httpClient.post(
        "/contacts/upsert",
        contactPayload,
      );
      return createResponse.data.contact as any;
    }
  }

  async getGhlContact(locationId: string, contactId: string): Promise<GhlContact | null> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      const response = await httpClient.get(`/contacts/${contactId}`);
      return response.data.contact as GhlContact;
    } catch (error) {
      this.logger.error(`Failed to fetch GHL contact ${contactId}: ${error.message}`);
      return null;
    }
  }

  async getGhlContactByPhone(locationId: string, phone: string): Promise<GhlContact> {
    return this.findOrCreateGhlContact(locationId, phone);
  }

  async updateGhlMessageStatus(
    locationId: string,
    messageId: string,
    status: "sent" | "delivered" | "read" | "failed",
    meta: Partial<MessageStatusPayload> = {},
  ): Promise<void> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      await httpClient.put(`/conversations/messages/status/${messageId}`, {
        status,
        ...meta,
      });
      this.logger.debug(`GHL message ${messageId} updated to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update status for message ${messageId}: ${error.message}`);
    }
  }

  async postInboundMessageToGhl(locationId: string, message: GhlPlatformMessage): Promise<SendResponse> {
    const httpClient = await this.getHttpClient(locationId);
    try {
      const response = await httpClient.post(
        "/conversations/messages/inbound",
        message,
      );
      return response.data as SendResponse;
    } catch (error) {
      this.logger.error(`Failed to POST inbound message to GHL: ${error.message}`);
      throw new IntegrationError(`Failed to POST inbound message to GHL`);
    }
  }

  // Backwards compatibility
  async sendInboundMessageToGhl(payload: {
    locationId: string;
    message: GhlPlatformMessage;
  }): Promise<SendResponse> {
    return this.postInboundMessageToGhl(payload.locationId, payload.message);
  }

  async createPlatformClient(locationId: string): Promise<HttpService> {
    const accessToken = await this.getAccessToken(locationId);
    return new HttpService(
      axios.create({
        baseURL: "https://services.leadconnectorhq.com",
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
      this.logger.error("Error sending message to GHL", error);
      throw new IntegrationError("Failed to send message to GHL");
    }
  }

  async getInstanceByUserId(userId: string): Promise<Instance | null> {
    const instances = await this.prisma.getInstancesByUserId(userId);
    if (!instances || instances.length === 0) return null;
    const sorted = instances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return sorted[0];
  }


  async handlePlatformWebhook(ghlWebhook: GhlWebhookDto, instanceId: bigint): Promise<void> {
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

      await this.evolution.sendMessage(instanceId.toString(), message);
    } catch (error) {
      this.logger.error(`Failed to handle outbound message webhook: ${error.message}`, error);
      throw new Error("Failed to forward outbound message to Evolution API");
    }
  }

  async handleEvolutionWebhook(webhook: EvolutionWebhook): Promise<void> {
    const idInstance =
      typeof webhook.instanceId === "bigint"
        ? webhook.instanceId
        : BigInt(webhook.instanceId as any);
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

  async updateInstanceState(
    instanceId: string | number | bigint,
    newState: InstanceState | string,
  ): Promise<void> {
    try {
      await this.prisma.instance.update({
        where: { idInstance: BigInt(instanceId as any) },
        data: {
          stateInstance: newState as InstanceState,
        },
      });
      this.logger.log(`Instance ${instanceId} state updated to ${newState}`);
    } catch (error) {
      this.logger.error(`Failed to update state of instance ${instanceId}: ${error.message}`);
    }
  }


  async createEvolutionApiInstanceForUser(
    userId: string,
    instanceId: string | number | bigint,
    apiToken: string,
    wid?: string,
    name?: string,
  ): Promise<Instance> {
    const idInst = BigInt(instanceId as any);
    const existing = await this.prisma.instance.findFirst({
      where: { idInstance: idInst },
    });

    if (existing) {
      this.logger.warn(`Instance ${instanceId} already exists. Skipping creation.`);
      return existing as unknown as Instance;
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

    this.logger.log(
      `New Evolution API instance created for user ${userId}: ${instanceId}`,
    );
    return newInstance as unknown as Instance;
  }

  async handleStateWebhook(
    instanceId: string | number | bigint,
    newState: string,
    wid?: string,
  ): Promise<void> {
    await this.updateInstanceState(instanceId, newState as InstanceState);

    if (wid) {
      const idInst = BigInt(instanceId as any);
      const instance = await this.prisma.instance.findUnique({
        where: { idInstance: idInst },
      });

      if (instance && instance.settings?.wid !== wid) {
        await this.prisma.instance.update({
          where: { idInstance: idInst },
          data: {
            settings: {
              ...instance.settings,
              wid,
            },
          },
        });
        this.logger.log(`Instance ${instanceId} WID updated to ${wid}`);
      }
    }
  }
}
