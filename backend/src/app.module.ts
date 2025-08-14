// wlink/backend/src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { EvolutionApiModule } from "./evolution-api/evolution-api.module";
import { EvolutionModule } from "./evolution/evolution.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { OauthModule } from "./oauth/oauth.module";
import { CustomPageModule } from "./custom-page/custom-page.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EvolutionApiModule,
    EvolutionModule,
    WebhooksModule,
    OauthModule,
    CustomPageModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
