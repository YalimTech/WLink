import { Module } from '@nestjs/common';
import { GhlOauthController } from './oauth.controller';
import { AuthService } from '../auth.service';
import { ConfigModule } from '@nestjs/config';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
  imports: [ConfigModule, EvolutionModule],
  controllers: [GhlOauthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class OauthModule {}

