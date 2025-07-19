// src/evolution/evolution.service.ts
import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EvolutionService {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>("EVOLUTION_API_URL")!;
  }

  async sendMessage(instanceToken: string, to: string, message: string) {
    const url = `${this.baseUrl}/message/sendText`; // Endpoint actualizado para v2.3.0
    try {
      const response$ = this.http.post(
        url,
        {
          number: to,
          options: { delay: 1200, presence: "composing" },
          textMessage: { text: message },
        },
        { headers: { apikey: instanceToken } },
      );
      const response = await lastValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new HttpException(
        "Error sending message via Evolution API",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getInstanceStatus(instanceToken: string, instanceId: string) {
    const url = `${this.baseUrl}/instance/connectionState/${instanceId}`;
    try {
      const response$ = this.http.get(url, {
        headers: { apikey: instanceToken },
      });
      const response = await lastValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new HttpException(
        "Error checking instance status",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Configura los webhooks para una instancia específica, incluyendo el token secreto.
   */
  async configureWebhooks(instanceToken: string, webhookUrl: string) {
    const url = `${this.baseUrl}/webhook/instance`;

    const payload = {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: [
        "application.status",
        "qrcode.updated",
        "connection.state",
        "messages.upsert",
        "messages.update",
      ],
    };

    try {
      const response$ = this.http.post(url, payload, {
        headers: { apikey: instanceToken },
      });
      await lastValueFrom(response$);
    } catch (error) {
      throw new HttpException(
        "Error configuring webhooks",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async fetchInstances(
    instanceToken: string,
  ): Promise<{ id: string; name: string }[]> {
    const url = `${this.baseUrl}/instance/fetchInstances`; // Corregido a endpoint correcto
    try {
      const response$ = this.http.get(url, {
        headers: { apikey: instanceToken },
      });
      const response = await lastValueFrom(response$);
      return (
        response.data?.map((i: any) => ({
          id: i.instance?.instanceName, // Ajustado a la estructura de respuesta de v2.3.0
          name: i.instance?.instanceName,
        })) ?? []
      );
    } catch (error) {
      throw new HttpException(
        "Error fetching instance list",
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
