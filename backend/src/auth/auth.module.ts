import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AuthController],
})
export class AuthModule {}


