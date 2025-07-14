import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { settings } from "./.evolutionapi";

declare global {
  namespace PrismaJson {
    // noinspection JSUnusedGlobalSymbols
    type InstanceSettings = typeof settings;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.use(helmet());
  app.enableShutdownHooks();
  await app.listen(3000);
}

void bootstrap();

