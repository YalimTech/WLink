// src/webhooks/guards/evolution-api-webhook.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class EvolutionApiWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers["x-evolution-token"] as string;
    const expected = this.configService.get<string>("INSTANCE_TOKEN");

    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid instance token");
    }

    return true;
  }
}
