import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Res,
  HttpException,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GhlOAuthCallbackDto } from './dto/ghl-oauth-callback.dto';
import { GhlExternalAuthPayloadDto } from './dto/ghl-external-auth-payload.dto';
import { GhlService } from '../ghl/ghl.service';
import { AuthService } from '../auth.service';

@Controller('oauth')
export class GhlOauthController {
  private readonly logger = new Logger(GhlOauthController.name);
  private readonly ghlServicesUrl = 'https://services.leadconnectorhq.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ghlService: GhlService,
    private readonly authService: AuthService,
  ) {}

  @Get('callback')
  async callback(
    @Query()
    query: GhlOAuthCallbackDto & { idInstance?: string; apiTokenInstance?: string },
    @Res() res: Response,
  ) {
    const { code, idInstance, apiTokenInstance } = query;
    this.logger.log(`GHL OAuth callback received. Code: ${code ? 'present' : 'MISSING'}`);

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
        scope,
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

      await this.prisma.user.upsert({
        where: { id: respLocationId },
        update: {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiresAt,
          companyId: respCompanyId,
        },
        create: {
          id: respLocationId,
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiresAt,
          companyId: respCompanyId,
        },
      });

      this.logger.log(`Stored/updated GHL tokens for Location: ${respLocationId}`);

      if (idInstance && apiTokenInstance) {
        try {
          await this.ghlService.createEvolutionApiInstanceForUser(
            respLocationId,
            idInstance,
            apiTokenInstance,
          );
          this.logger.log(`Evolution API instance ${idInstance} stored for location ${respLocationId}`);
        } catch (err) {
          this.logger.error(`Failed to store Evolution API instance: ${err.message}`);
        }
      }

      return res.status(200).send(`<h1>WLink Bridge autorizado correctamente.</h1>`);
    } catch (error) {
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

  @Post('external-auth-credentials')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async externalAuthCredentials(
    @Query('instance_id') queryInstanceId: string,
    @Query('api_token_instance') queryApiToken: string,
    @Query('locationId') queryLocationId: string,
    @Body() body: GhlExternalAuthPayloadDto,
  ) {
    const instanceId =
      queryInstanceId || body?.instance_id || body?.instanceId;
    const apiToken =
      queryApiToken || body?.api_token_instance || body?.apiTokenInstance;
    const locationId =
      queryLocationId || body?.locationId?.[0] || body?.locationId;

    this.logger.log(
      `Received external auth credentials - instanceId: ${instanceId}, locationId: ${locationId}`,
    );

    if (!locationId) {
      throw new HttpException('Missing locationId', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.findUnique({ where: { id: locationId } });
    if (!user) {
      throw new HttpException(
        'OAuth must be completed before submitting instance credentials.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!instanceId || !apiToken) {
      throw new HttpException('Missing instance credentials', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.authService.validateInstance(instanceId, apiToken);
      await this.ghlService.createEvolutionApiInstanceForUser(
        locationId,
        instanceId,
        apiToken,
      );

      this.logger.log(
        `Validated and stored instance ${instanceId} for location ${locationId}`,
      );

      return {
        message: 'Valid credentials',
      };
    } catch (err) {
      this.logger.error(`Credential validation failed: ${err.message}`);
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('external-auth-body')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async externalAuthBody(
    @Body() payload: GhlExternalAuthPayloadDto,
  ) {
    const instanceId = payload.instance_id;
    const apiToken = payload.api_token_instance;
    const locationId = payload.locationId?.[0] ?? (payload as any).locationId;

    this.logger.log(
      `Received external auth via body - instanceId: ${instanceId}, locationId: ${locationId}`,
    );

    if (!locationId) {
      throw new HttpException('Missing locationId in body', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.findUnique({ where: { id: locationId } });
    if (!user) {
      throw new HttpException(
        'OAuth must be completed before submitting instance credentials.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!instanceId || !apiToken) {
      throw new HttpException('Missing instance credentials', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.authService.validateInstance(instanceId, apiToken);
      await this.ghlService.createEvolutionApiInstanceForUser(
        locationId,
        instanceId,
        apiToken,
      );

      this.logger.log(
        `Validated and stored instance ${instanceId} from body for location ${locationId}`,
      );

      return {
        message: 'Valid credentials (from body)',
      };
    } catch (err) {
      this.logger.error(`Credential validation (body) failed: ${err.message}`);
      throw new HttpException('Invalid credentials (from body)', HttpStatus.UNAUTHORIZED);
    }
  }
}

