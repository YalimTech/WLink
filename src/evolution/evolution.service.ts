// src/evolution/evolution.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EvolutionService {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiUrl = this.configService.get<string>('EVOLUTION_API_URL');
    if (!apiUrl) {
      throw new Error('EVOLUTION_API_URL is not configured');
    }
    this.baseUrl = apiUrl;
  }

  async sendMessage(instanceToken: string, to: string, message: string) {
    const url = `${this.baseUrl}/message/sendText`; // Endpoint actualizado para v2.3.0
    try {
      const response$ = this.http.post(
        url,
        {
          number: to,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: message },
        },
        { headers: { apikey: instanceToken } },
      );
      const response = await lastValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error sending message via Evolution API',
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
        'Error checking instance status',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Configura los webhooks para una instancia específica, incluyendo el token secreto.
   */
  async configureWebhooks(instanceName: string, instanceToken: string, webhookUrl: string) {
    // El endpoint para configurar webhooks por instancia usa el NOMBRE de la instancia
    const url = `${this.baseUrl}/webhook/instance/${instanceName}`;
    const secret = this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('EVOLUTION_WEBHOOK_SECRET is not configured');
    }

    const payload = {
      url: webhookUrl,
      webhook_token: secret, // <-- ESTA ES LA CORRECCIÓN CLAVE
      enabled: true,
      webhook_by_events: false, // Para recibir todos los eventos en una sola URL
      events: [
        "application.status",
        "qrcode.updated",
        "connection.state",
        "messages.upsert",
        "messages.update",
      ],
    };

    try {
      const response$ = this.http.put(url, payload, {
        headers: { apikey: instanceToken },
      });
      await lastValueFrom(response$);
    } catch (error) {
      throw new HttpException(
        'Error configuring webhooks',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async fetchInstances(instanceToken: string): Promise<{ id: string; name: string }[]> {
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
        'Error fetching instance list',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

