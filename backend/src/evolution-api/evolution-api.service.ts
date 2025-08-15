// src/evolution-api/evolution-api.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, AxiosError } from "axios";
import {
  BaseAdapter,
  NotFoundError,
  IntegrationError,
} from "../core/base-adapter";
import { EvolutionApiTransformer } from "./evolution-api.transformer";
import { PrismaService } from "../prisma/prisma.service";
import { EvolutionService } from "../evolution/evolution.service";
import { GhlWebhookDto } from "./dto/ghl-webhook.dto";
import {
  User,
  Instance,
  GhlPlatformMessage,
  EvolutionWebhook,
  GhlContact,
  GhlContactUpsertRequest,
  GhlContactUpsertResponse,
  InstanceState,
} from "../types";
import { createDecipheriv, createCipheriv, createHash, randomBytes } from "crypto";

@Injectable()
export class EvolutionApiService extends BaseAdapter<
  GhlPlatformMessage,
  EvolutionWebhook,
  User,
  Instance
> {
  private readonly ghlApiBaseUrl = "https://services.leadconnectorhq.com";
  private readonly ghlApiVersion = "2021-07-28";

  constructor(
    protected readonly evolutionApiTransformer: EvolutionApiTransformer,
    protected readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly evolutionService: EvolutionService,
    logger: Logger,
  ) {
    super(evolutionApiTransformer, prisma, logger);
  }

  // CAMBIO: Parámetro 'ghlUserId' a 'ghlLocationId'
  private async getHttpClient(ghlLocationId: string): Promise<AxiosInstance> {
    // CAMBIO: Usar 'locationId' para buscar usuario
    const userWithTokens = await this.prisma.getUserWithTokens(ghlLocationId);
    if (!userWithTokens?.accessToken || !userWithTokens?.refreshToken) {
      this.logger.error(
        `No tokens found for GHL User (Location ID): ${ghlLocationId}`,
      );
      throw new HttpException(
        `GHL auth tokens not found. Please re-authorize the application.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    let currentAccessToken = this.decryptToken(userWithTokens.accessToken || "");
    const willExpireSoon =
      userWithTokens.tokenExpiresAt &&
      new Date(userWithTokens.tokenExpiresAt).getTime() <
        Date.now() + 5 * 60 * 1000;

    if (willExpireSoon) {
      this.logger.log(
        `Access token for User ${ghlLocationId} is expiring. Refreshing...`,
      );
      try {
        const newTokens = await this.refreshGhlAccessToken(
          this.decryptToken(userWithTokens.refreshToken || ""),
        );
        // CAMBIO: Usar 'locationId' para actualizar tokens de usuario
        const encAccess = this.encryptToken(newTokens.access_token);
        const encRefresh = this.encryptToken(newTokens.refresh_token);
        await this.prisma.updateUserTokens(
          ghlLocationId,
          encAccess,
          encRefresh,
          new Date(Date.now() + newTokens.expires_in * 1000),
        );
        currentAccessToken = newTokens.access_token;
      } catch (_e: any) {
        throw new HttpException(
          `Unable to refresh GHL token. Please re-authorize.`,
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    return axios.create({
      baseURL: this.ghlApiBaseUrl,
      headers: {
        Authorization: `Bearer ${currentAccessToken}`,
        Version: this.ghlApiVersion,
        "Content-Type": "application/json",
      },
    });
  }

  private async refreshGhlAccessToken(refreshToken: string): Promise<any> {
    const body = new URLSearchParams({
      // **CORRECCIÓN AQUÍ:** Se cambió 'GHL_CLIENT_CLIENT_ID' a 'GHL_CLIENT_ID'
      client_id: this.configService.get("GHL_CLIENT_ID")!,
      client_secret: this.configService.get("GHL_CLIENT_SECRET")!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      user_type: "Location",
    });
    const response = await axios.post(
      `${this.ghlApiBaseUrl}/oauth/token`,
      body,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
    return response.data;
  }

  private getEncryptionKey() {
    const secret =
      this.configService.get<string>("TOKEN_ENCRYPTION_KEY") ||
      this.configService.get<string>("GHL_SHARED_SECRET") ||
      "fallback-secret";
    return createHash("sha256").update(secret).digest();
  }

  private encryptToken(raw: string): string {
    if (!raw) return raw;
    try {
      const key = this.getEncryptionKey();
      const iv = randomBytes(16);
      const cipher = createCipheriv("aes-256-cbc", key, iv);
      const enc = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]).toString("base64");
      return `${iv.toString("base64")}:${enc}`;
    } catch {
      return raw;
    }
  }

  private decryptToken(stored: string): string {
    if (!stored) return stored;
    try {
      const [ivB64, encB64] = stored.split(":");
      if (!ivB64 || !encB64) return stored; // Assume plaintext
      const key = this.getEncryptionKey();
      const iv = Buffer.from(ivB64, "base64");
      const encrypted = Buffer.from(encB64, "base64");
      const decipher = createDecipheriv("aes-256-cbc", key, iv);
      const dec = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
      return dec;
    } catch {
      return stored; // Fallback for legacy plaintext
    }
  }

  /**
   * ✅ NUEVO MÉTODO: Obtiene los detalles de un usuario de GHL por su ID.
   * @param locationId El ID de la ubicación (para obtener el token de acceso).
   * @param ghlLocationId El ID del usuario de GHL (obtenido del callback OAuth).
   * @returns Los detalles del usuario de GHL o null si no se encuentra.
   */
  public async getGhlUserDetails(
    locationId: string,
    ghlLocationId: string,
  ): Promise<any | null> {
    try {
      const httpClient = await this.getHttpClient(locationId);
      const response = await httpClient.get(`/users/${ghlLocationId}`); // Endpoint para obtener detalles del usuario
      this.logger.log(
        `Fetched GHL user details for ${ghlLocationId}: ${JSON.stringify(response.data)}`,
      );
      return response.data?.user || response.data; // La respuesta puede variar, a veces viene en 'user'
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        this.logger.warn(
          `GHL User ${ghlLocationId} not found for location ${locationId}.`,
        );
        return null;
      }
      this.logger.error(
        `Error fetching GHL user details for ${ghlLocationId}: ${error.message}`,
        error.stack,
      );
      throw new IntegrationError(
        `Failed to fetch GHL user details: ${error.message}`,
      );
    }
  }

  public async getGhlContactByPhone(
    locationId: string,
    phone: string,
  ): Promise<GhlContact | null> {
    const httpClient = await this.getHttpClient(locationId);
    try {
      const response = await httpClient.get(
        `/contacts/lookup?phone=${encodeURIComponent(phone)}`,
      );
      return response.data?.contacts?.[0] || null;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      this.logger.error(
        `Error fetching contact by phone in GHL: ${(error as AxiosError).message}`,
      );
      throw error;
    }
  }

  private async findOrCreateGhlContact(
    locationId: string,
    phone: string,
    name: string,
    instanceName: string, // CAMBIO: Parámetro 'instanceId' a 'instanceName'
  ): Promise<GhlContact> {
    const httpClient = await this.getHttpClient(locationId);
    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    // CAMBIO: Usar 'instanceName' para la etiqueta
    const tag = `whatsapp-instance-${instanceName}`;

    const upsertPayload: GhlContactUpsertRequest = {
      name: name || `WhatsApp User ${formattedPhone.slice(-4)}`,
      locationId: locationId,
      phone: formattedPhone,
      tags: [tag],
      source: "EvolutionAPI Integration",
    };

    const { data } = await httpClient.post<GhlContactUpsertResponse>(
      "/contacts/upsert",
      upsertPayload,
    );
    if (!data?.contact) {
      throw new IntegrationError(
        "Could not get contact from GHL upsert response.",
      );
    }
    return data.contact;
  }

  public async handlePlatformWebhook(
    ghlWebhook: GhlWebhookDto,
    instanceName: string, // CAMBIO: Parámetro 'instanceId' a 'instanceName'
  ): Promise<void> {
    // CAMBIO: Usar 'instanceName' para buscar la instancia
    const instance = await this.prisma.getInstance(instanceName);
    if (!instance)
      throw new NotFoundError(`Instance ${instanceName} not found`); // CAMBIO: Usar 'instanceName'
    if (instance.state !== "authorized")
      throw new IntegrationError(`Instance ${instanceName} is not authorized`); // CAMBIO: Usar 'instanceName'

    await this.evolutionService.sendMessage(
      instance.apiTokenInstance,
      instance.instanceName, // CAMBIO: Usar 'instanceName'
      ghlWebhook.phone,
      ghlWebhook.message,
    );
    await this.updateGhlMessageStatus(
      ghlWebhook.locationId,
      ghlWebhook.messageId,
      "delivered",
    );
  }

  /**
   * Maneja los webhooks entrantes de Evolution API.
   * ✅ MEJORA: Más logs para depurar el estado de la instancia.
   */
  public async handleEvolutionWebhook(
    webhook: EvolutionWebhook,
  ): Promise<void> {
    const instanceName = webhook.instance; // Este es el instanceName de Evolution API
    if (!instanceName) {
      this.logger.warn(
        "[EvolutionApiService] Webhook received without an instance name. Ignoring.",
      );
      return;
    }

    this.logger.log(
      `[EvolutionApiService] Processing webhook for instance: '${instanceName}', Event: '${webhook.event}'.`,
    );
    this.logger.debug(
      `[EvolutionApiService] Full Webhook Payload: ${JSON.stringify(webhook)}`,
    );

    if (
      webhook.event === "connection.update" &&
      typeof webhook.data?.state !== "undefined"
    ) {
      const state = webhook.data.state;
      let mappedStatus: InstanceState;

      switch (state) {
        case "open": // Evolution API uses 'open' for authorized
          mappedStatus = "authorized";
          break;
        case "connecting":
          mappedStatus = "starting";
          break;
        case "close": // Evolution API uses 'close' for disconnected
          mappedStatus = "notAuthorized";
          break;
        case "qrcode": // Sometimes the state might directly be 'qrcode'
          mappedStatus = "qr_code";
          break;
        default:
          this.logger.warn(
            `[EvolutionApiService] Unknown connection state received for '${instanceName}': '${state}'. Not updating state.`,
          );
          return;
      }

      this.logger.log(
        `[EvolutionApiService] Attempting to update instance '${instanceName}' state from webhook. Mapped Status: '${mappedStatus}'`,
      );
      // CAMBIO: Usar 'instanceName' para actualizar el estado en la DB
      const updated = await this.prisma.updateInstanceState(
        instanceName,
        mappedStatus,
      );

      if (updated) {
        this.logger.log(
          `[EvolutionApiService] Instance '${instanceName}' state updated to '${mappedStatus}' via webhook.`,
        );
      } else {
        this.logger.warn(
          `[EvolutionApiService] Webhook for instance '${instanceName}' received, but could not find/update it in DB. Check instance name.`,
        );
      }
    } else if (
      webhook.event === "messages.upsert" &&
      webhook.data?.key?.remoteJid
    ) {
      // Buscar la instancia por su instanceName (que es el 'instance' del webhook)
      const instance = await this.prisma.getInstance(instanceName);
      if (!instance) {
        this.logger.warn(
          `[EvolutionApiService] Webhook 'messages.upsert' for unknown instance '${instanceName}'. Ignoring message.`,
        );
        return;
      }

      const { data } = webhook;
      const senderPhone = data.key.remoteJid.split("@")[0];
      const senderName =
        data.pushName || `WhatsApp User ${senderPhone.slice(-4)}`;
      const ghlContact = await this.findOrCreateGhlContact(
        instance.locationId, // CAMBIO: Usar instance.locationId
        senderPhone,
        senderName,
        instance.instanceName, // CAMBIO: Usar instance.instanceName
      );
      const transformedMsg = this.transformer.toPlatformMessage(webhook);
      transformedMsg.contactId = ghlContact.id;
      transformedMsg.locationId = instance.locationId; // CAMBIO: Usar instance.locationId
      await this.postInboundMessageToGhl(instance.locationId, transformedMsg); // CAMBIO: Usar instance.locationId
      this.logger.log(
        `[EvolutionApiService] Message upsert processed for instance '${instanceName}'.`,
      );
    } else {
      this.logger.log(
        `[EvolutionApiService] Evolution Webhook event '${webhook.event}' received for instance '${instanceName}'. No specific handler or missing data. Full Payload: ${JSON.stringify(webhook)}`,
      );
    }
  }

  /**
   * Conecta una instancia de Evolution API existente con una ubicación de GHL
   * y la guarda en la base de datos local.
   *
   * @param locationId El ID de la ubicación GHL del usuario al que pertenece la instancia.
   * @param evolutionApiInstanceName El identificador único de la instancia en Evolution API (el ID que el admin creó manualmente).
   * @param apiToken El token de la API específico para esta instancia.
   * @param customName El nombre personalizado que el usuario final quiere darle a la instancia (opcional).
   * @returns La instancia conectada y guardada en la DB.
   * @throws HttpException si la instancia ya existe para esta ubicación, o si las credenciales no son válidas.
   */
  public async createEvolutionApiInstanceForUser(
    // Renombrar a 'connectExistingEvolutionApiInstance' sería más claro
    locationId: string,
    evolutionApiInstanceName: string,
    apiToken: string,
    customName?: string,
  ): Promise<Instance> {
    this.logger.log(
      `[EvolutionApiService] Intentando conectar instancia existente: '${evolutionApiInstanceName}' (Nombre personalizado: '${customName || "N/A"}') para la ubicación: '${locationId}'`,
    );

    // 1. Comprobar si ya existe una instancia con este ID de Evolution API para esta ubicación.
    const existing = await this.prisma.getInstance(evolutionApiInstanceName);
    if (existing && existing.locationId === locationId) {
      this.logger.warn(
        `[EvolutionApiService] La instancia '${evolutionApiInstanceName}' ya existe para esta ubicación.`,
      );
      throw new HttpException(
        `Una instancia con ID '${evolutionApiInstanceName}' ya existe para tu cuenta de WLink.`,
        HttpStatus.CONFLICT,
      );
    }

    try {
      // 2. Validar las credenciales (del token específico de la instancia) y obtener el estado.
      // NO intentamos CREAR la instancia aquí, solo VALIDAR su existencia y credenciales.
      this.logger.log(
        `[EvolutionApiService] Validando credenciales para la instancia existente: '${evolutionApiInstanceName}'...`,
      );
      const isValid = await this.evolutionService.validateInstanceCredentials(
        apiToken,
        evolutionApiInstanceName,
      );

      if (!isValid) {
        this.logger.error(
          `[EvolutionApiService] Credenciales inválidas para la instancia: '${evolutionApiInstanceName}'.`,
        );
        // CAMBIO: Mensaje de error más específico para el usuario.
        throw new Error(
          "Credenciales de instancia (ID o Token) no válidas. Verifica que la instancia exista en Evolution Manager y que el token sea correcto.",
        );
      }
      this.logger.log(
        `[EvolutionApiService] Credenciales válidas para '${evolutionApiInstanceName}'. Obteniendo estado inicial...`,
      );

      const statusInfo = await this.evolutionService.getInstanceStatus(
        apiToken,
        evolutionApiInstanceName,
      );

      const state = statusInfo?.instance?.state || "close";
      const mappedState: InstanceState =
        state === "open"
          ? "authorized"
          : state === "connecting"
            ? "starting"
            : state === "qrcode"
              ? "qr_code"
              : "notAuthorized";

      this.logger.log(
        `[EvolutionApiService] Estado inicial para '${evolutionApiInstanceName}' de Evolution API: '${state}'. Mapeado a: '${mappedState}'`,
      );

      // 3. Guardar la instancia en la base de datos local.
      const newInstance = await this.prisma.createInstance({
        instanceName: evolutionApiInstanceName, // instanceName será el ID único de Evolution API
        instanceId: statusInfo?.instance?.instanceId || null, // instanceId será el GUID de Evolution
        apiTokenInstance: apiToken,
        user: { connect: { locationId: locationId } },
        customName: customName || `Instancia ${evolutionApiInstanceName}`, // Se usa el customName, o uno por defecto
        state: mappedState,
        settings: {},
      });
      this.logger.log(
        `[EvolutionApiService] Instancia '${evolutionApiInstanceName}' conectada en la DB con estado inicial: '${mappedState}'.`,
      );
      return newInstance;
    } catch (error) {
      this.logger.error(
        `[EvolutionApiService] Falló la conexión o validación de instancia '${evolutionApiInstanceName}': ${error.message}. Stack: ${error.stack}`,
      );
      if (error instanceof HttpException) throw error;
      // CAMBIO: Mensaje de error más descriptivo para el usuario final.
      throw new HttpException(
        `Falló la conexión o validación de la instancia. Error: ${error.message}. Asegúrate de que el ID y el Token de la instancia sean correctos y que la instancia exista en Evolution Manager.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async updateGhlMessageStatus(
    locationId: string,
    messageId: string,
    status: "delivered" | "read" | "failed" | "sent",
  ): Promise<void> {
    this.logger.log(
      `Updating message ${messageId} status to ${status} for location ${locationId}`,
    );
  }

  private async postInboundMessageToGhl(
    locationId: string,
    message: GhlPlatformMessage,
  ): Promise<void> {
    this.logger.log(
      `Posting inbound message to GHL for location ${locationId}: ${message.message}`,
    );
  }
}
