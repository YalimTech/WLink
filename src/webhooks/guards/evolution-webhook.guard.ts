// src/webhooks/guards/evolution-webhook.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { BaseEvolutionApiAuthGuard } from '../../evolutionapi';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EvolutionWebhookGuard extends BaseEvolutionApiAuthGuard implements CanActivate {
  constructor(storageService: PrismaService) {
    super(storageService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    return this.validateRequest(request);
  }
}
