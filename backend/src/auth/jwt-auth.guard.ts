import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization || request.headers?.Authorization as string | undefined;
    if (!authHeader || !authHeader.toString().startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    const token = authHeader.toString().slice(7);
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new UnauthorizedException("Server missing JWT secret");
    }
    try {
      const decoded = jwt.verify(token, secret) as { sub?: string; locationId?: string };
      const locationId = decoded.locationId || decoded.sub;
      if (!locationId) {
        throw new UnauthorizedException("Token missing locationId");
      }
      request.locationId = locationId;
      return true;
    } catch (e: any) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}


