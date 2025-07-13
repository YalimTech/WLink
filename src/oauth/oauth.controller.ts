import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GhlOAuthCallbackDto } from './dto/ghl-oauth-callback.dto';
import { GhlExternalAuthPayloadDto } from './dto/ghl-external-auth-payload.dto';
import { Logger } from '@nestjs/common';
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
    @Query() query: GhlOAuthCallbackDto & { idInstance?: string; apiTokenInstance?: string },
    @Res() res: Response,
  ) {
    const { code, idInstance, apiTokenInstance } = query;
    this.logger.log(`GHL OAuth callback received. Code: ${code ? 'present' : 'MISSING'}`);

    if (!code) {
      this.logger.error('GHL OAuth callback missing code.');
      throw new HttpException('Invalid OAuth callback from GHL (missing code).', HttpStatus.BAD_REQUEST);
    }

    const clientId = this.configService.get<string>('GHL_CLIENT_ID')!;
    const clientSecret = this.configService.get<string>('GHL_CLIENT_SECRET')!;
    const appUrl = this.configService.get<string>('APP_URL')!;

    const tokenRequestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: appUrl + '/oauth/callback',
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
        throw new HttpException('Failed to get Location ID from GHL token response.', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      this.logger.log(
        `GHL Tokens obtained for Location ${respLocationId}, Company ${respCompanyId}. Scopes: ${scope}`,
      );
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
      this.logger.log(`Stored/updated GHL tokens for User (Location ID): ${respLocationId}`);

      if (idInstance && apiTokenInstance) {
        try {
          await this.ghlService.createEvolutionApiInstanceForUser(
            respLocationId,
            idInstance,
            apiTokenInstance,
          );
          this.logger.log(
            `Evolution API instance ${idInstance} stored for location ${respLocationId}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to create Evolution API instance for user ${respLocationId}: ${err.message}`,
          );
        }
      }

      return res.status(200).send(`...success HTML omitted for brevity...`);
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
  async externalAuthCredentials(
    @Query('instance_id') instanceId: string,
    @Query('api_token_instance') apiToken: string,
    @Query('locationId') locationIdParam: string,
    @Body() body: any,
  ) {
    const locationId =
      locationIdParam ||
      (Array.isArray(body?.locationId) ? body.locationId[0] : body?.locationId);

    if (!locationId) {
      throw new HttpException('locationId missing', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.findUnique({ where: { id: locationId } });
    if (!user) {
      throw new HttpException('OAuth must be completed before external auth.', HttpStatus.BAD_REQUEST);
    }

    if (!instanceId || !apiToken) {
      throw new HttpException('Missing instance credentials', HttpStatus.BAD_REQUEST);
    }

    await this.authService.validateInstance(instanceId, apiToken);

    await this.ghlService.createEvolutionApiInstanceForUser(locationId, instanceId, apiToken);

    return { success: true };
  }

  @Post('external-auth-body')
  async externalAuthBody(@Body() payload: GhlExternalAuthPayloadDto) {
    const locationId = payload.locationId?.[0];

    const user = await this.prisma.user.findUnique({ where: { id: locationId } });
    if (!user) {
      throw new HttpException('OAuth must be completed before external auth.', HttpStatus.BAD_REQUEST);
    }

    await this.authService.validateInstance(payload.instance_id, payload.api_token_instance);

    await this.ghlService.createEvolutionApiInstanceForUser(
      locationId,
      payload.instance_id,
      payload.api_token_instance,
    );

    return { success: true };
  }
}
