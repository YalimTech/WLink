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
        { headers: { Authorization: `Bearer ${instanceToken}` } },
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

  async getInstanceStatus(instanceToken: string) {
    const url = `${this.baseUrl}/instance/status`;

    try {
      const response$ = this.http.get(url, {
        headers: { Authorization: `Bearer ${instanceToken}` },
      });
      const response = await lastValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new HttpException('Error checking instance status', HttpStatus.BAD_REQUEST);
    }
  }
}
