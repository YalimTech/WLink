import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  HttpCode,
  Res,
  Req,
  HttpException,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GhlOAuthCallbackDto } from './dto/ghl-oauth-callback.dto';
import { GhlExternalAuthPayloadDto } from './dto/ghl-external-auth-payload.dto';
import { GhlService } from '../ghl/ghl.service';

@Controller('oauth')
export class GhlOauthController {
  private readonly ghlServicesUrl = 'https://services.leadconnectorhq.com';

  constructor(
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ghlService: GhlService,
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

      return res.status(200).send(this.generateSuccessHtml());
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
@HttpCode(HttpStatus.OK)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
async handleExternalAuthCredentials(
  @Query('instance_id') queryInstanceId: string,
  @Query('api_token_instance') queryApiToken: string,
  @Query('locationId') queryLocationId: string,
  @Body() body: GhlExternalAuthPayloadDto,
): Promise<{ message: string }> {
  const instanceId = queryInstanceId || body?.instance_id;
  const apiToken = queryApiToken || body?.api_token_instance;
  const locationId = queryLocationId || body?.locationId?.[0];

  if (!locationId) {
    throw new HttpException('locationId is missing', HttpStatus.BAD_REQUEST);
  }
  if (!instanceId || !apiToken) {
    throw new HttpException('Missing Evolution API credentials', HttpStatus.BAD_REQUEST);
  }

  const user = await this.prisma.findUser(locationId);
  if (!user) {
    throw new HttpException(
      'OAuth step might have failed or been skipped.',
      HttpStatus.BAD_REQUEST,
    );
  }

  await this.ghlService.createEvolutionApiInstanceForUser(locationId, instanceId, apiToken);

  return { message: 'Evolution API instance connected successfully.' };
}





   
  @Post('external-auth-body')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async handleExternalAuthBody(
    @Body() payload: GhlExternalAuthPayloadDto,
  ): Promise<{ message: string }> {
    const instanceId = payload.instance_id;
    const apiToken = payload.api_token_instance;
    const locationId = Array.isArray(payload.locationId)
      ? payload.locationId[0]
      : payload.locationId;

    this.logger.log(
      `Received external auth via body - instanceId: ${instanceId}, locationId: ${locationId}`,
    );

    if (!locationId || !instanceId || !apiToken) {
      throw new HttpException('Missing required fields in body', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.findUnique({ where: { id: locationId } });
    if (!user) {
      throw new HttpException(
        'OAuth must be completed before submitting instance credentials.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
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

  private generateSuccessHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>OAuth Authentication Complete</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; background: #f4f6f8; }
            .container { background: white; padding: 30px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            h1 { color: #2d3436; margin-bottom: 20px; }
            .check { font-size: 48px; color: #4caf50; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="check">✅</div>
            <h1>Authentication Complete!</h1>
            <p>Your workspace has been successfully connected to Evolution API.</p>
            <p>You can close this page.</p>
          </div>
        </body>
      </html>
    `;
  }
}
