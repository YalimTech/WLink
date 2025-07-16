import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { WebhooksController } from "./webhooks.controller";
import { GhlModule } from "../ghl/ghl.module";
import { EvolutionWebhookGuard } from './guards/evolution-webhook.guard';

@Module({
        imports: [ConfigModule, GhlModule],
        controllers: [WebhooksController],
        providers: [EvolutionWebhookGuard, Logger],
})
export class WebhooksModule {}
