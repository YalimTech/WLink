// wlink/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

// --- INICIO DE LA CORRECCIÓN ---
// Soluciona el error de serialización de BigInt en las respuestas JSON.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
// --- FIN DE LA CORRECCIÓN ---

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configura la aplicación para usar pipes de validación, seguridad y JSON.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Allow embedding in iFrames for GoHighLevel integration
  // Se deshabilita frameguard para permitir que la aplicación sea embebida en un iframe.
  // Se deshabilita contentSecurityPolicy si no se va a definir una política CSP específica,
  // ya que la CSP por defecto de Helmet podría ser demasiado restrictiva.
  app.use(
    helmet({
      frameguard: false, 
      contentSecurityPolicy: false, 
    }),
  );

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Habilita CORS para permitir peticiones desde el frontend.
  // La configuración de Nginx también maneja esto, pero es una buena práctica
  // tenerlo también en el backend si se accede directamente.
  app.enableCors({
    origin: '*', // Se puede restringir a dominios específicos de GHL si se conoce
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(3001);
}
bootstrap();
