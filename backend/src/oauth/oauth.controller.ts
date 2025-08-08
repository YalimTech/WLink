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
import axios from "axios";
import { PrismaService } from "../prisma/prisma.service";
import { GhlOAuthCallbackDto } from "./dto/ghl-oauth-callback.dto";
import { EvolutionApiService } from "../evolution-api/evolution-api.service";

@Controller("oauth")
export class GhlOauthController {
  private readonly ghlServicesUrl = "https://services.leadconnectorhq.com";
  private readonly logger: Logger; // Declarado aquí

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly evolutionApiService: EvolutionApiService,
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
      this.logger.error("[OAuth Callback] Error: Código de autorización faltante.");
      throw new HttpException(
        "Invalid OAuth callback from GHL (missing code).",
        HttpStatus.BAD_REQUEST,
      );
    }

    const clientId = this.configService.get<string>("GHL_CLIENT_ID")!;
    const clientSecret = this.configService.get<string>("GHL_CLIENT_SECRET")!;
    const appUrl = this.configService.get<string>("APP_URL")!;

    this.logger.log(`[OAuth Callback] APP_URL: ${appUrl}`);

    const tokenRequestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: `${appUrl}/oauth/callback`,
      user_type: "Location",
    });

    try {
      this.logger.log("[OAuth Callback] Intercambiando código por tokens...");
      
      const tokenResponse = await axios.post(
        `${this.ghlServicesUrl}/oauth/token`,
        tokenRequestBody.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );

      const {
        access_token,
        refresh_token,
        expires_in,
        companyId: respCompanyId,
        locationId: respLocationId,
      } = tokenResponse.data;

      if (!respLocationId) {
        this.logger.error(
          "[OAuth Callback] Error: No se recibió locationId en la respuesta de GHL",
          tokenResponse.data,
        );
        throw new HttpException(
          "Failed to get Location ID from GHL token response.",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

      await this.prisma.createUser({
        locationId: respLocationId,
        accessToken: access_token,
        refreshToken: refresh_token,
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

      // SOLUCIÓN AL PROBLEMA DE REDIRECCIONES
      // Construir la URL correcta considerando el basePath de Next.js
      const frontendUrlFromEnv = this.configService.get<string>("FRONTEND_URL");
      let redirectUrl: string;

      if (frontendUrlFromEnv) {
        // Si FRONTEND_URL está definida, usarla directamente con oauth-success
        // FRONTEND_URL ya incluye /app, así que solo agregamos oauth-success
        redirectUrl = `${frontendUrlFromEnv.replace(/\/$/, '')}/oauth-success`;
      } else {
        // Si no está definida, usar APP_URL + /app/oauth-success
        this.logger.warn(
          "[OAuth Callback] FRONTEND_URL no está definida. Usando APP_URL/app como fallback.",
        );
        redirectUrl = `${appUrl}/app/oauth-success`;
      }

      // Logging detallado para debugging
      this.logger.log(`[OAuth Callback] FRONTEND_URL desde env: ${frontendUrlFromEnv}`);
      this.logger.log(`[OAuth Callback] URL de redirección construida: ${redirectUrl}`);

      // Validar que la URL esté bien formada
      try {
        new URL(redirectUrl);
      } catch (urlError) {
        this.logger.error(`[OAuth Callback] URL de redirección inválida: ${redirectUrl}`);
        throw new HttpException(
          "Invalid redirect URL configuration",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(
        `[OAuth Callback] Redirigiendo a la página de éxito: ${redirectUrl}`,
      );

      // Usar redirect permanente (301) en lugar de temporal para evitar bucles
      return res.redirect(301, redirectUrl);
      
    } catch (error: any) {
      this.logger.error("[OAuth Callback] Error al intercambiar código OAuth por tokens:", error);
      
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
}
