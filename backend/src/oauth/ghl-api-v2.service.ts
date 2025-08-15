// wlink/backend/src/oauth/ghl-api-v2.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

interface GhlTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  companyId?: string;
  locationId?: string;
}

@Injectable()
export class GhlApiV2Service {
  private readonly logger = new Logger(GhlApiV2Service.name);
  private readonly baseUrl = "https://services.leadconnectorhq.com";

  constructor(private readonly config: ConfigService) {}

  async exchangeCodeForTokens(code: string): Promise<GhlTokenResponse> {
    const clientId = this.config.get<string>("GHL_CLIENT_ID")!;
    const clientSecret = this.config.get<string>("GHL_CLIENT_SECRET")!;
    const appUrl = this.config.get<string>("APP_URL")!;

    const redirectUri = `${appUrl}/oauth/callback`;

    const payload = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    } as const;

    this.logger.log("[GHL v2] Intercambiando código por tokens (JSON payload)");

    const { data } = await axios.post<GhlTokenResponse>(
      `${this.baseUrl}/oauth/token`,
      payload,
      { headers: { "Content-Type": "application/json", Accept: "application/json" } },
    );

    if (!data || !data.access_token || !data.refresh_token) {
      this.logger.error("[GHL v2] Respuesta inválida al intercambiar tokens", data as any);
      throw new Error("Invalid token response from GHL API v2");
    }

    return data;
  }
}


