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
   * CORREGIDO: Verifica el estado de la conexión de una instancia.
   * Utiliza el endpoint oficial /instance/connectionState/{instanceName}
   * y el header 'apikey' según la documentación.
   * @param instanceToken - El API Token de la instancia.
   * @param instanceName - El nombre (ID) de la instancia a verificar.
   */
  async getInstanceStatus(instanceToken: string, instanceName: string) {
    const url = `${this.baseUrl}/instance/connectionState/${instanceName}`;

    try {
      const response$ = this.http.get(url, {
        headers: { apikey: instanceToken },
      });
      const response = await lastValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new HttpException('Error checking instance status', HttpStatus.BAD_REQUEST);
    }
  }

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
      throw new HttpException('Error configuring webhooks', HttpStatus.BAD_REQUEST);
    }
  }
}
