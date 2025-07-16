// src/webhooks/guards/evolution-api-webhook.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { BaseEvolutionApiAuthGuard } from '../../evolutionapi';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EvolutionApiWebhookGuard extends BaseEvolutionApiAuthGuard implements CanActivate {
  constructor(
    storageService: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super(storageService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = (request.headers['x-evolution-token'] || request.headers['x-webhook-token']) as string;
    const secret = this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET');
    if (secret && token !== secret) {
      return false;
    }
    return this.validateRequest(request);
  }
}
