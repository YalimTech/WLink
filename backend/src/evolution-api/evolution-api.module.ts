import { Module, Logger } from "@nestjs/common";
import { EvolutionApiService } from "./evolution-api.service";
import { EvolutionApiTransformer } from "./evolution-api.transformer";
import { EvolutionApiController } from "./evolution-api.controller";
import { QrController } from "./qr.controller";
import { EvolutionModule } from "../evolution/evolution.module";
import { GhlContextGuard } from "./guards/ghl-context.guard";
import { ConfigModule } from "@nestjs/config";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Module({
  imports: [EvolutionModule, ConfigModule],
  providers: [
    Logger,
    EvolutionApiService,
    EvolutionApiTransformer,
    GhlContextGuard,
    JwtAuthGuard,
  ],
  exports: [EvolutionApiService, EvolutionApiTransformer, GhlContextGuard],
  controllers: [EvolutionApiController, QrController],
})
export class EvolutionApiModule {}
