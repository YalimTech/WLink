import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { BaseEvolutionApiAuthGuard } from "../../evolutionapi";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class EvolutionWebhookGuard extends BaseEvolutionApiAuthGuard implements CanActivate {
  constructor(protected readonly storageService: PrismaService) {
    super(storageService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }
}
