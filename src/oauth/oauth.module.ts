import { Module } from '@nestjs/common';
import { GhlOauthController } from './oauth.controller';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { ConfigModule } from '@nestjs/config';
import { EvolutionModule } from '../evolution/evolution.module';
import { PrismaService } from '../common/prisma.service'; // Si usas Prisma

@Module({
  imports: [ConfigModule, EvolutionModule],
  controllers: [GhlOauthController, AuthController],
  providers: [AuthService, PrismaService],
})
export class OauthModule {}

