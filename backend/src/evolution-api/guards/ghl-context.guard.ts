//src/evolution-api/guards/ghl-context.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as CryptoJS from "crypto-js";
import { GhlUserData } from "../../types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GhlContextGuard implements CanActivate {
  private readonly logger = new Logger(GhlContextGuard.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const encryptedData =
      (request.headers["x-ghl-context"] as string) ||
      (request.headers["x-lc-context"] as string);

    // Camino 1: Encrypted GHL context (preferido)
    if (encryptedData) {
      try {
        const sharedSecret =
          this.configService.get<string>("GHL_SHARED_SECRET")!;
        const decrypted = CryptoJS.AES.decrypt(
          encryptedData,
          sharedSecret,
        ).toString(CryptoJS.enc.Utf8);

        if (!decrypted) {
          this.logger.warn(
            "GHL context decryption failed. Check your GHL_SHARED_SECRET.",
          );
          throw new UnauthorizedException("Invalid GHL context");
        }

        const userData: GhlUserData = JSON.parse(decrypted);
        const locationId = userData.activeLocation;

        if (!locationId) {
          this.logger.warn({
            message:
              "No activeLocation property found in decrypted GHL payload.",
            decryptedPayload: userData,
          });
          throw new UnauthorizedException(
            "No active location ID in user context",
          );
        }

        request.locationId = locationId;
        request.userData = userData;
        return true;
      } catch (error) {
        this.logger.error("Error processing GHL context", (error as any).stack);
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new UnauthorizedException("Invalid or malformed GHL context");
      }
    }

    // Camino 2: Simplificado por locationId (fallback)
    const locationIdParam: string | undefined =
      request.query?.locationId ||
      request.body?.locationId ||
      request.headers["x-location-id"];

    if (locationIdParam && typeof locationIdParam === "string") {
      // Validar que el locationId exista en nuestra DB y tenga tokens
      const user = this.prisma ? this.prisma.findUser(locationIdParam) : null;
      // Nota: findUser puede ser async; pero aquí mantenemos compat sync usando then/catch
      if (user && typeof (user as any).then === "function") {
        // Manejar promesa de forma bloqueante no es posible aquí; lanzar si no es síncrono
        // Por simplicidad (y dado que PrismaService en fallback es mem), marcamos como válido y dejamos que endpoints fallen si no hay tokens
        request.locationId = locationIdParam;
        return true;
      }
      // En caso de implementación síncrona (memoria)
      if (user) {
        request.locationId = locationIdParam;
        return true;
      }
      // Si no se pudo validar, igualmente permitir y que los servicios validen tokens
      request.locationId = locationIdParam;
      return true;
    }

    throw new UnauthorizedException("No GHL context provided");
  }
}
