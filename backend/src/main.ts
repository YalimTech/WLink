// wlink/backend/src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { json, urlencoded } from "express";

// --- INICIO DE LA CORRECCIÓN ---
// Soluciona el error de serialización de BigInt en las respuestas JSON.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
// --- FIN DE LA CORRECCIÓN ---

async function bootstrap() {
  // --- INICIO DE LA MEJORA: Validar variables de entorno críticas ---
  const logger = new Logger("Bootstrap");
  const requiredEnvVars = [
    "DATABASE_URL",
    "GHL_CLIENT_ID",
    "GHL_CLIENT_SECRET",
    "APP_URL",
    "FRONTEND_URL",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(
        `FATAL ERROR: Environment variable ${envVar} is not defined.`,
      );
      process.exit(1); // Detiene el proceso si una variable crítica falta
    }
  }
  // --- FIN DE LA MEJORA ---

  const app = await NestFactory.create(AppModule);

  // Habilitar la confianza en el proxy para que NestJS reconozca el protocolo HTTPS
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

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

  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ limit: "50mb", extended: true }));

  // Habilita CORS para permitir peticiones desde el frontend.
  // La configuración de Nginx también maneja esto, pero es una buena práctica
  // tenerlo también en el backend si se accede directamente.
  app.enableCors({
    origin: "*", // Se puede restringir a dominios específicos de GHL si se conoce
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(process.env.PORT || 3005);
}
bootstrap();
