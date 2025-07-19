// src/webhooks/guards/evolution-api-webhook.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class EvolutionApiWebhookGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = (request.headers['x-evolution-token'] || request.headers['x-webhook-token']) as string;
    const secret = this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET');

    // Si el secreto no está configurado en el servidor, rechaza la petición por seguridad.
    if (!secret) {
      throw new ForbiddenException('Webhook secret is not configured on the server.');
    }

    // Compara el token de la petición con el secreto del servidor.
    if (token !== secret) {
      throw new UnauthorizedException('Invalid webhook token.');
    }

    // Si los tokens coinciden, permite el acceso.
    return true;
  }
}
