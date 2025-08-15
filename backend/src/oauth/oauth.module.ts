import { Module, Logger } from "@nestjs/common";
import { GhlOauthController } from "./oauth.controller";
import { ConfigModule } from "@nestjs/config";
import { EvolutionModule } from "../evolution/evolution.module";
import { EvolutionApiModule } from "../evolution-api/evolution-api.module";
import { GhlApiV2Service } from "./ghl-api-v2.service";

@Module({
  imports: [ConfigModule, EvolutionModule, EvolutionApiModule],
  controllers: [GhlOauthController],
  providers: [Logger, GhlApiV2Service],
})
export class OauthModule {}
