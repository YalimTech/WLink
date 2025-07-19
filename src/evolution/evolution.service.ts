// src/evolution/evolution.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvolutionService {
  private readonly baseUrl = process.env.EVOLUTION_API_URL;

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async sendMessage(instanceToken: string, to: string, message: string) {
    const url = `${this.baseUrl}/message/send-text`;

    try {
      const response$ = this.http.post(
        url,
        { to, text: message },
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

  /**
   * Checks the connection status of an Evolution instance by its ID.
   */
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
   * Configura los webhooks oficiales de Evolution API.
   */
  async configureWebhooks(instanceToken: string, webhookUrl: string) {
    const url = `${this.baseUrl}/instance/webhook`;
    const payload = {
      webhookUrl,
      webhookTypes: [
        'incomingMessageReceived',
        'outgoingMessageReceived',
        'stateInstanceChanged',
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

  /**
   * ✅ Nuevo método: Obtiene todas las instancias asociadas al token del usuario.
   */
  async fetchInstances(instanceToken: string): Promise<{ id: string; name: string }[]> {
    const url = `${this.baseUrl}/instances`;

    try {
      const response$ = this.http.get(url, {
        headers: { apikey: instanceToken },
      });
      const response = await lastValueFrom(response$);
      return (
        response.data.instances?.map((i: any) => ({
          id: i.id?.toString?.() || String(i.id),
          name: i.name,
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

