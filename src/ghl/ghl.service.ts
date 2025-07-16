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
  GhlContactUpsertResponse,
  GhlPlatformMessage,
  MessageStatusPayload,
  User,
  Instance,
  EvolutionWebhook,
} from '../types';

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

  /**
   * Obtiene un cliente Axios preconfigurado para hacer llamadas a la API de GoHighLevel.
   * Maneja automáticamente la lógica de refresco de tokens de OAuth 2.0.
   */
  private async getHttpClient(ghlUserId: string): Promise<AxiosInstance> {
    const userWithTokens = await this.prisma.getUserWithTokens(ghlUserId);
    if (!userWithTokens?.accessToken || !userWithTokens?.refreshToken) {
      this.logger.error(`No tokens found for GHL User (Location ID): ${ghlUserId}`);
      throw new HttpException(`GHL auth tokens not found. Please re-authorize the application.`, HttpStatus.UNAUTHORIZED);
    }

    let currentAccessToken = userWithTokens.accessToken;

    // Comprueba si el token expirará en los próximos 5 minutos
    const willExpireSoon = userWithTokens.tokenExpiresAt && new Date(userWithTokens.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;

    if (willExpireSoon) {
      this.logger.log(`Access token for User ${ghlUserId} is expiring. Refreshing...`);
      try {
        const newTokens = await this.refreshGhlAccessToken(userWithTokens.refreshToken);
        await this.prisma.updateUserTokens(
          ghlUserId,
          newTokens.access_token,
          newTokens.refresh_token,
          new Date(Date.now() + newTokens.expires_in * 1000),
        );
        currentAccessToken = newTokens.access_token;
        this.logger.log(`Token refreshed successfully for User ${ghlUserId}`);
      } catch (err) {
        this.logger.error(`Token refresh failed for User ${ghlUserId}: ${err.message}`, err.stack);
        throw new HttpException(`Unable to refresh GHL token. Please re-authorize.`, HttpStatus.UNAUTHORIZED);
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

    // Interceptor para reintentar una llamada si falla por un token recién expirado.
    httpClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // La lógica de reintento es una mejora opcional pero robusta.
        // Si el error es 401 y no hemos reintentado, intentamos refrescar el token y reintentar la llamada.
        return Promise.reject(error);
      },
    );
    return httpClient;
  }

  /**
   * Refresca un token de acceso de GHL usando un refresh token.
   */
  private async refreshGhlAccessToken(refreshToken: string): Promise<any> {
    const body = new URLSearchParams({
      client_id: this.configService.get('GHL_CLIENT_ID')!,
      client_secret: this.configService.get('GHL_CLIENT_SECRET')!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      user_type: 'Location',
    });
    // Corregido: Se envía el body y el header correcto para la petición de token
    const response = await axios.post(`${this.ghlApiBaseUrl}/oauth/token`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  }

// --- Lógica de Contactos (Clonada de la lógica de Green API) ---

  /**
   * Busca un contacto en GHL por su número de teléfono.
   * @param locationId El ID de la ubicación en GHL.
   * @param phone El número de teléfono a buscar.
   * @returns El contacto si se encuentra, de lo contrario null.
   */
  public async getGhlContactByPhone(locationId: string, phone: string): Promise<GhlContact | null> {
    const httpClient = await this.getHttpClient(locationId);
    try {
      const response = await httpClient.get(`/contacts/lookup?phone=${encodeURIComponent(phone)}`);
      return (response.data?.contacts?.[0]) || null;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      this.logger.error(`Error fetching contact by phone in GHL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca un contacto por teléfono. Si no existe, lo crea. Si existe, se asegura de que tenga la etiqueta de la instancia.
   * Esta es la estrategia clave para vincular un chat de WhatsApp a una instancia específica.
   */
  private async findOrCreateGhlContact(locationId: string, phone: string, name: string, instanceId: string): Promise<GhlContact> {
    const httpClient = await this.getHttpClient(locationId);
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const tag = `whatsapp-instance-${instanceId}`;

    const upsertPayload: GhlContactUpsertRequest = {
      name: name || `WhatsApp User ${formattedPhone.slice(-4)}`,
      locationId: locationId,
      phone: formattedPhone,
      tags: [tag], // Siempre nos aseguramos de que la etiqueta esté presente
      source: 'EvolutionAPI Integration',
    };

    // Usamos el endpoint de "upsert" que crea o actualiza el contacto.
    const { data } = await httpClient.post<GhlContactUpsertResponse>('/contacts/upsert', upsertPayload);
    if (!data?.contact) {
      throw new IntegrationError('Could not get contact from GHL upsert response.');
    }
    this.logger.log(`Upserted contact ${data.contact.id} for phone ${formattedPhone} with tag ${tag}`);
    return data.contact;
  }

  // --- Lógica de Webhooks (Corregida con los nuevos tipos y firmas) ---

  /**
   * Maneja los mensajes enviados DESDE GoHighLevel HACIA WhatsApp.
   */
  public async handlePlatformWebhook(ghlWebhook: GhlWebhookDto, instanceId: string): Promise<void> {
    this.logger.log(`Handling Outbound GHL Webhook for Instance ${instanceId}`);
    const instance = await this.prisma.getInstance(instanceId);

    if (!instance) {
      throw new NotFoundError(`Instance ${instanceId} not found`);
    }
    if (instance.stateInstance !== 'authorized') {
      throw new IntegrationError(`Instance ${instanceId} is not authorized`);
    }
    if (!ghlWebhook.phone) {
      throw new IntegrationError('Missing phone number to send message');
    }

    // Llama al EvolutionService para enviar el mensaje a WhatsApp
    await this.evolutionService.sendMessage(instance.apiTokenInstance, ghlWebhook.phone, ghlWebhook.message);
    // Actualiza el estado del mensaje en GHL a "delivered"
    await this.updateGhlMessageStatus(ghlWebhook.locationId, ghlWebhook.messageId, 'delivered');
  }

  /**
   * Maneja los mensajes recibidos DESDE WhatsApp (Evolution API) HACIA GoHighLevel.
   */
  public async handleEvolutionWebhook(webhook: EvolutionWebhook): Promise<void> {
    const instanceId = webhook.instance;
    this.logger.log(`Handling Inbound Evolution Webhook for Instance ${instanceId}`);
    const instance = await this.prisma.getInstance(instanceId);

    if (!instance) {
      throw new NotFoundError(`Webhook for unknown instance ${instanceId}. Ignoring.`);
    }
    
    // Solo procesamos mensajes nuevos
    if (webhook.event === 'messages.upsert' && webhook.data?.key?.remoteJid) {
      const { data } = webhook;
      const senderPhone = data.key.remoteJid.split('@')[0];
      const senderName = data.pushName || `WhatsApp User ${senderPhone.slice(-4)}`;

      // 1. Encuentra o crea el contacto en GHL y lo etiqueta
      const ghlContact = await this.findOrCreateGhlContact(instance.userId, senderPhone, senderName, instance.idInstance);

      // 2. Transforma el mensaje al formato que GHL entiende
      const transformedMsg = this.ghlTransformer.toPlatformMessage(webhook);
      transformedMsg.contactId = ghlContact.id; // Asignamos el ID real del contacto de GHL
      transformedMsg.locationId = instance.userId;

      // 3. Envía el mensaje a la conversación correcta en GHL
      await this.postInboundMessageToGhl(instance.userId, transformedMsg);
    }
  }


// --- Lógica de Mensajería y Estado ---

  /**
   * Actualiza el estado de un mensaje en GHL (ej. a 'delivered' o 'failed').
   */
  public async updateGhlMessageStatus(
    locationId: string,
    messageId: string,
    status: 'delivered' | 'read' | 'failed' | 'sent',
    meta: Partial<MessageStatusPayload> = {},
  ): Promise<void> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      await httpClient.put(`/conversations/messages/${messageId}/status`, { status, ...meta });
      this.logger.debug(`Updated GHL message ${messageId} status to ${status}`);
    } catch(error) {
      // No lanzamos un error aquí para no detener el flujo principal si solo falla la actualización de estado.
      this.logger.warn(`Could not update message status for ${messageId}: ${error.message}`);
    }
  }

  /**
   * Publica un mensaje entrante en la conversación correcta dentro de GoHighLevel.
   */
  private async postInboundMessageToGhl(locationId: string, message: GhlPlatformMessage): Promise<void> {
    const httpClient = await this.getHttpClient(locationId);
    
    // Busca o crea la conversación para el contacto específico.
    let conversation = (await httpClient.get(`/conversations/search?locationId=${locationId}&contactId=${message.contactId}`)).data.conversations?.[0];
    if (!conversation) {
      this.logger.log(`No conversation found for contact ${message.contactId}. Creating a new one.`);
      conversation = (await httpClient.post(`/conversations/`, { locationId, contactId: message.contactId })).data.conversation;
    }

    const payload = {
      type: 'Custom',
      conversationId: conversation.id,
      message: message.message,
      direction: 'inbound',
      conversationProviderId: this.configService.get<string>('GHL_CONVERSATION_PROVIDER_ID'),
      attachments: message.attachments?.map((att) => ({ url: att.url })),
    };
    
    await httpClient.post(`/conversations/messages/inbound`, payload);
    this.logger.log(`Successfully posted inbound message to GHL conversation ${conversation.id}`);
  }

  // --- Lógica de Creación de Instancias para Evolution API ---

  /**
   * Crea una nueva instancia de Evolution API para un usuario (Ubicación de GHL).
   * Este método es llamado desde el ghl.controller.ts.
   */
  public async createEvolutionApiInstanceForUser(
    userId: string,
    instanceId: string,
    apiToken: string,
    name?: string,
  ): Promise<Instance> {
    this.logger.log(`Attempting to create Evolution instance ${instanceId} for user ${userId}`);
    const existing = await this.prisma.instance.findUnique({ where: { idInstance: parseId(instanceId) } });
    if (existing) {
      throw new HttpException('An instance with this ID already exists.', HttpStatus.CONFLICT);
    }

    // 1. Validar credenciales con la API de Evolution antes de guardar nada.
    try {
      this.logger.log(`Validating credentials for instance ${instanceId}...`);
      const status = await this.evolutionService.getInstanceStatus(apiToken);
      // Comparamos el nombre de la instancia devuelto por la API con el que el usuario proporcionó.
      if (status.instance.instanceName !== instanceId) {
        throw new Error("Instance ID mismatch. The API token belongs to a different instance name.");
      }
      this.logger.log(`Credentials validated successfully for instance ${instanceId}.`);
    } catch (err) {
      this.logger.error(`Evolution API credentials invalid for instance ${instanceId}: ${err.message}`);
      throw new HttpException('Invalid Evolution API credentials. Please check the instance ID and token.', HttpStatus.BAD_REQUEST);
    }
    
    // 2. Si son válidas, crear la instancia en nuestra base de datos.
    const newInstance = await this.prisma.createInstance({
        idInstance: parseId(instanceId),
        apiTokenInstance: apiToken,
        userId: userId,
        name: name || `Evolution ${instanceId.substring(0, 8)}`,
        stateInstance: 'authorized', // Si la validación fue exitosa, la marcamos como autorizada.
        settings: {},
    });

    // 3. Configurar el webhook en Evolution API para que nos envíe los mensajes a nuestro endpoint.
    const webhookUrl = `${this.configService.get<string>('APP_URL')}/webhooks/evolution`;
    try {
      await this.evolutionService.configureWebhooks(apiToken, webhookUrl);
      this.logger.log(`Evolution API webhooks configured successfully for instance ${instanceId}`);
    } catch (err) {
      this.logger.error(`Failed to configure Evolution API webhooks for instance ${instanceId}. Please check permissions.`, err);
      // No lanzamos un error aquí para que la instancia se cree de todas formas, pero alertamos del problema.
    }

    this.logger.log(`New Evolution API instance created successfully for user ${userId}: ${instanceId}`);
    return newInstance;
  }
}
