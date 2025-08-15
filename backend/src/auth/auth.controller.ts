import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import * as CryptoJS from "crypto-js";
import * as jwt from "jsonwebtoken";

@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("start-session-from-iframe")
  async startSessionFromIframe(
    @Body() body: { encryptedData?: string },
  ): Promise<{ success: boolean; sessionToken?: string; message?: string }> {
    const { encryptedData } = body || {};
    if (!encryptedData) {
      throw new HttpException("Missing encryptedData", HttpStatus.BAD_REQUEST);
    }

    const sharedSecret = this.config.get<string>("GHL_SHARED_SECRET");
    if (!sharedSecret) {
      throw new HttpException(
        "Server misconfigured: missing GHL_SHARED_SECRET",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(
        encryptedData,
        sharedSecret,
      ).toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        throw new Error("Failed to decrypt payload");
      }
      const payload = JSON.parse(decrypted) as {
        activeLocation?: string;
        locationId?: string;
        email?: string;
        fullName?: string;
      };
      const locationId = payload.activeLocation || payload.locationId;
      if (!locationId) {
        throw new Error("No locationId in decrypted payload");
      }

      const user = await this.prisma.findUser(locationId);
      if (!user) {
        // Creamos un esqueleto si no existe aún
        await this.prisma.createUser({
          locationId,
          email: payload.email || null,
          firstName: payload.fullName || null,
        } as any);
      }

      const jwtSecret = this.config.get<string>("JWT_SECRET");
      if (!jwtSecret) {
        throw new Error("Server misconfigured: missing JWT_SECRET");
      }

      const sessionToken = jwt.sign(
        {
          sub: locationId,
          locationId,
          typ: "wlink_iframe",
        },
        jwtSecret,
        { expiresIn: "10m" },
      );

      return { success: true, sessionToken };
    } catch (err: any) {
      throw new HttpException(
        `Failed to start session: ${err.message}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}


