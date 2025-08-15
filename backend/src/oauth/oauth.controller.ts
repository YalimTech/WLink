// wlink/backend/src/oauth/oauth.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { GhlOAuthCallbackDto } from "./dto/ghl-oauth-callback.dto";
import { EvolutionApiService } from "../evolution-api/evolution-api.service";
import { GhlApiV2Service } from "./ghl-api-v2.service";
import { createCipheriv, randomBytes, createHash } from "crypto";

@Controller("oauth")
export class GhlOauthController {
  private readonly ghlServicesUrl = "https://services.leadconnectorhq.com";
  private readonly logger: Logger; // Declarado aquí

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly ghlApiV2: GhlApiV2Service,
  ) {
    this.logger = new Logger(GhlOauthController.name); // Inicializado en el constructor
  }

  @Get("callback")
  async callback(
    @Req() req: Request,
    @Query()
    query: GhlOAuthCallbackDto & {
      instanceName?: string;
      token?: string;
      customName?: string;
    },
    @Res() res: Response,
  ) {
    const { code, instanceName, token, customName } = query;
    this.logger.log(
      `[OAuth Callback] Iniciando proceso. Code: ${code ? "present" : "MISSING"}`,
    );

    if (!code) {
      this.logger.error(
        "[OAuth Callback] Error: Código de autorización faltante.",
      );
      throw new HttpException(
        "Invalid OAuth callback from GHL (missing code).",
        HttpStatus.BAD_REQUEST,
      );
    }

    const appUrl = this.configService.get<string>("APP_URL")!;

    this.logger.log(`[OAuth Callback] APP_URL: ${appUrl}`);

    try {
      this.logger.log("[OAuth Callback] Intercambiando código por tokens (via GhlApiV2Service)...");
      const { access_token, refresh_token, expires_in, companyId: respCompanyId, locationId: respLocationId } =
        await this.ghlApiV2.exchangeCodeForTokens(code);

      if (!respLocationId) {
        this.logger.error(
          "[OAuth Callback] Error: No se recibió locationId en la respuesta de GHL",
        );
        throw new HttpException(
          "Failed to get Location ID from GHL token response.",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

      const { encryptedAccess, encryptedRefresh } = this.encryptTokens(access_token, refresh_token);

      await this.prisma.createUser({
        locationId: respLocationId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        companyId: respCompanyId,
      });

      this.logger.log(
        `[OAuth Callback] Tokens guardados exitosamente para Location: ${respLocationId}`,
      );

      if (instanceName && token && customName) {
        try {
          await this.evolutionApiService.createEvolutionApiInstanceForUser(
            respLocationId,
            instanceName,
            token,
            customName,
          );
          this.logger.log(
            `[OAuth Callback] Instancia Evolution API '${instanceName}' (Custom Name: '${customName}') almacenada para location '${respLocationId}'`,
          );
        } catch (err: any) {
          this.logger.error(
            `[OAuth Callback] Error al almacenar instancia Evolution API: ${err.message}`,
          );
        }
      }

      // Después del OAuth exitoso, necesitamos redirigir de vuelta a GoHighLevel
      // para que la aplicación se cargue dentro del contexto del iframe
      
      // Primero, creamos una página de éxito que mostrará un mensaje temporal
      const frontendUrl =
        this.configService.get<string>("FRONTEND_URL") || appUrl;
      const successUrl = new URL("/oauth-success", frontendUrl);
      successUrl.searchParams.set("locationId", respLocationId);
      successUrl.searchParams.set("status", "success");
      
      const redirectUrl = successUrl.toString();

      // Logging para debugging
      this.logger.log(
        `[OAuth Callback] Redirigiendo a página de éxito OAuth: ${redirectUrl}`,
      );
      this.logger.log(
        `[OAuth Callback] El usuario debe volver a GoHighLevel y abrir la aplicación desde allí`,
      );

      // Validar que la URL esté bien formada
      try {
        new URL(redirectUrl);
      } catch (urlError) {
        this.logger.error(
          `[OAuth Callback] URL de redirección inválida: ${redirectUrl}`,
          urlError,
        );
        throw new HttpException(
          "Invalid redirect URL configuration",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Usar redirect temporal (302) y desactivar caché
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.redirect(302, redirectUrl);
    } catch (error: any) {
      this.logger.error(
        "[OAuth Callback] Error al intercambiar código OAuth por tokens:",
        error,
      );

      // Si es un error de axios, extraer información útil
      if (error.response) {
        this.logger.error(`[OAuth Callback] Status: ${error.response.status}`);
        this.logger.error(`[OAuth Callback] Data:`, error.response.data);
      }

      const errorDesc =
        (error.response?.data as any)?.error_description ||
        (error.response?.data as any)?.error ||
        "Unknown GHL OAuth error";

      throw new HttpException(
        `Failed to obtain GHL tokens: ${errorDesc}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private encryptTokens(accessToken: string, refreshToken: string): { encryptedAccess: string; encryptedRefresh: string } {
    const secret = this.configService.get<string>("TOKEN_ENCRYPTION_KEY") || this.configService.get<string>("GHL_SHARED_SECRET") || "fallback-secret";
    const key = createHash("sha256").update(secret).digest();
    const iv = randomBytes(16);

    const cipherA = createCipheriv("aes-256-cbc", key, iv);
    const encA = Buffer.concat([cipherA.update(accessToken, "utf8"), cipherA.final()]).toString("base64");

    const cipherR = createCipheriv("aes-256-cbc", key, iv);
    const encR = Buffer.concat([cipherR.update(refreshToken, "utf8"), cipherR.final()]).toString("base64");

    const ivB64 = iv.toString("base64");
    return {
      encryptedAccess: `${ivB64}:${encA}`,
      encryptedRefresh: `${ivB64}:${encR}`,
    };
  }
}
