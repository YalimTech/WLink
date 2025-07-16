import { Module, Logger } from "@nestjs/common";
import { GhlOauthController } from "./oauth.controller";
import { ConfigModule } from "@nestjs/config";
import { EvolutionModule } from "../evolution/evolution.module";
import { GhlModule } from "../ghl/ghl.module";

@Module({
  imports: [ConfigModule, EvolutionModule, GhlModule],
  controllers: [GhlOauthController],
  providers: [Logger],
})
export class OauthModule {}


