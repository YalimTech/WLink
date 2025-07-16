import { Module, Logger } from "@nestjs/common";
import { GhlService } from "./ghl.service";
import { GhlTransformer } from "./ghl.transformer";
import { GhlController } from './ghl.controller';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
        imports: [EvolutionModule],
        providers: [Logger, GhlService, GhlTransformer],
        exports: [GhlService, GhlTransformer],
        controllers: [GhlController],
})
export class GhlModule {}
