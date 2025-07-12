import { Logger } from '@nestjs/common';
import { MessageTransformer } from '../types/message.interface';
import { StorageProvider } from '../evolutionapi';

export class IntegrationError extends Error {}
export class NotFoundError extends Error {}

export abstract class BaseAdapter<WebhookPayload, PlatformMessage, User, Instance> {
  protected readonly logger = new Logger(this.constructor.name);

  protected evolution = {
    async sendMessage(_instanceId: string, _message: any): Promise<void> {
      // stub method
    },
  };

  protected constructor(
    protected readonly transformer: MessageTransformer<WebhookPayload, PlatformMessage>,
    protected readonly storageService: StorageProvider<User, Instance, any, any>,
  ) {}

  protected async getAccessToken(_userId: string): Promise<string> {
    const user: any = await this.storageService.getUserWithTokens(_userId as any);
    return (user && (user as any).accessToken) || '';
  }
}
