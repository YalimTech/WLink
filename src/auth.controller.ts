import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('oauth')
export class AuthController {
  @Post('external-auth-credentials')
  async externalAuth(@Req() req: Request, @Res() res: Response) {
    const instanceId =
      (req.body as any)?.instanceId ||
      req.query.instanceId ||
      req.query.instance_id;

    const instanceToken =
      (req.body as any)?.instanceToken ||
      req.query.instanceToken ||
      req.query.api_token_instance;

    if (!instanceId || !instanceToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing instanceId or instanceToken',
      });
    }

    return res.status(200).json({
      success: true,
      instanceId,
      instanceToken,
    });
  }
}
