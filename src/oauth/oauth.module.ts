import { Module } from "@nestjs/common";
import { GhlOauthController } from "./oauth.controller";
import { AuthController } from "../auth.controller";
import { AuthService } from "../auth.service";
import { ConfigModule } from "@nestjs/config";
import { EvolutionModule } from "../evolution/evolution.module";

@Module({
  imports: [ConfigModule, EvolutionModule],
  controllers: [GhlOauthController, AuthController],
  providers: [AuthService],
})
export class OauthModule {}
