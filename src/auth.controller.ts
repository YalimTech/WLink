import { Controller, Post, Res, Body, Query, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('oauth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('external-auth-credentials')
  async externalAuth(
    @Query('instance_id') instanceIdParam: string,
    @Query('instanceId') instanceIdCamel: string,
    @Query('api_token_instance') tokenParam: string,
    @Query('instanceToken') tokenCamel: string,
    @Body('instance_id') bodyInstanceIdParam: string,
    @Body('instanceId') bodyInstanceIdCamel: string,
    @Body('api_token_instance') bodyTokenParam: string,
    @Body('instanceToken') bodyTokenCamel: string,
    @Res() res: Response,
  ) {
    const instanceId =
      bodyInstanceIdCamel ||
      bodyInstanceIdParam ||
      instanceIdCamel ||
      instanceIdParam;

    const instanceToken =
      bodyTokenCamel ||
      bodyTokenParam ||
      tokenCamel ||
      tokenParam;

    if (!instanceId || !instanceToken) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Missing instanceId or instanceToken',
      });
    }

    try {
      const status = await this.authService.validateInstance(
        instanceId,
        instanceToken,
      );
      return res.status(HttpStatus.OK).json({
        success: true,
        instanceId,
        instanceToken,
        status,
      });
    } catch (error: any) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: error.message,
      });
    }
  }
}
