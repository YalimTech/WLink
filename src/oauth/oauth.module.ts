import { Module } from "@nestjs/common";
import { GhlOauthController } from "./oauth.controller";
import { AuthController } from "../auth.controller";
import { AuthService } from "../auth.service";
import { ConfigModule } from "@nestjs/config";
import { EvolutionModule } from "../evolution/evolution.module";
import { GhlModule } from "../ghl/ghl.module";

@Module({
  imports: [ConfigModule, EvolutionModule, GhlModule],
  controllers: [GhlOauthController, AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class OauthModule {}
