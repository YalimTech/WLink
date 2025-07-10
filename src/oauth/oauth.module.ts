import { Module } from "@nestjs/common";
import { GhlOauthController } from "./oauth.controller";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { GhlOAuthCallbackDto } from "./dto/ghl-oauth-callback.dto";

@Module({
  imports: [ConfigModule], // para poder usar ConfigService
  controllers: [GhlOauthController],
  providers: [PrismaService],
})
export class OauthModule {}
