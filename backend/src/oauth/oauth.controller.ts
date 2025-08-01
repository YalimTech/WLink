// wlink/backend/src/oauth/oauth.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GhlOAuthCallbackDto } from './dto/ghl-oauth-callback.dto';
import { EvolutionApiService } from '../evolution-api/evolution-api.service';

@Controller('oauth')
export class GhlOauthController {
  private readonly ghlServicesUrl = 'https://services.leadconnectorhq.com';
  private readonly logger: Logger; // Declarado aquí

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly evolutionApiService: EvolutionApiService,
  ) {
    this.logger = new Logger(GhlOauthController.name); // Inicializado en el constructor
  }

  @Get('callback')
  async callback(
    @Query()
    query: GhlOAuthCallbackDto & {
      instanceName?: string;
      token?: string;
      customName?: string;
    },
    @Res() res: Response,
  ) {
    const { code, instanceName, token, customName } = query;
    this.logger.log(`GHL OAuth callback recibido. Code: ${code ? 'present' : 'MISSING'}`);

    if (!code) {
      this.logger.error('GHL OAuth callback missing code.');
      throw new HttpException(
        'Invalid OAuth callback from GHL (missing code).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const clientId = this.configService.get<string>('GHL_CLIENT_ID')!;
    const clientSecret = this.configService.get<string>('GHL_CLIENT_SECRET')!;
    const appUrl = this.configService.get<string>('APP_URL')!;

    const tokenRequestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: `${appUrl}/oauth/callback`,
      user_type: 'Location',
    });

    try {
      const tokenResponse = await axios.post(
        `${this.ghlServicesUrl}/oauth/token`,
        tokenRequestBody.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const {
        access_token,
        refresh_token,
        expires_in,
        // scope, // 'scope' no se usa, se puede omitir si no es necesario
        companyId: respCompanyId,
        locationId: respLocationId,
      } = tokenResponse.data;

      if (!respLocationId) {
        this.logger.error('GHL Token response did not include locationId!', tokenResponse.data);
        throw new HttpException(
          'Failed to get Location ID from GHL token response.',
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

      this.logger.log(`Stored/updated GHL tokens for Location: ${respLocationId}`);

      if (instanceName && token && customName) {
        try {
          await this.evolutionApiService.createEvolutionApiInstanceForUser(
            respLocationId,
            instanceName,
            token,
            customName,
          );
          this.logger.log(`Evolution API instance '${instanceName}' (Custom Name: '${customName}') stored for location '${respLocationId}'`);
        } catch (err: any) {
          this.logger.error(`Failed to store Evolution API instance: ${err.message}`);
        }
      }
      
      // CAMBIO CRUCIAL: Redirigir al frontend de Next.js
      const successPageUrl = `${appUrl}/oauth-success`; 
      this.logger.log(`Redirigiendo a la página de éxito del frontend: ${successPageUrl}`);
      return res.redirect(HttpStatus.FOUND, successPageUrl);
      
    } catch (error: any) {
      this.logger.error('Error exchanging GHL OAuth code for tokens:', error);
      const errorDesc =
        (error.response?.data as any)?.error_description ||
        (error.response?.data as any)?.error ||
        'Unknown GHL OAuth error';
      throw new HttpException(
        `Failed to obtain GHL tokens: ${errorDesc}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
