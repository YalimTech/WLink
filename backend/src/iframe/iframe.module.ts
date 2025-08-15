import { Module } from '@nestjs/common';
import { IframeController } from './iframe.controller';

@Module({
  controllers: [IframeController],
})
export class IframeModule {}
