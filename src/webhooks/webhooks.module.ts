import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { WebhooksController } from "./webhooks.controller";
import { EvolutionApiModule } from "../evolution-api/evolution-api.module";
import { EvolutionApiWebhookGuard } from './guards/evolution-api-webhook.guard';

@Module({
        imports: [ConfigModule, EvolutionApiModule],
        controllers: [WebhooksController],
        providers: [EvolutionApiWebhookGuard, Logger],
})
export class WebhooksModule {}
