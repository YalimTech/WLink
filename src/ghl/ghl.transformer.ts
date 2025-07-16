import { Injectable, Logger } from '@nestjs/common';
import { MessageTransformer } from '../core/base-adapter';
import { GhlPlatformMessage, EvolutionWebhook } from '../types';

@Injectable()
export class GhlTransformer implements MessageTransformer<GhlPlatformMessage, EvolutionWebhook> {
  constructor(private readonly logger: Logger) {}

  /**
   * Transforma un webhook entrante de Evolution API a un formato que GoHighLevel entiende.
   * @param webhook El payload completo del webhook de Evolution API.
   * @returns Un objeto GhlPlatformMessage listo para ser enviado a GHL.
   */
  toPlatformMessage(webhook: EvolutionWebhook): GhlPlatformMessage {
    this.logger.debug(`Transforming Evolution webhook: ${JSON.stringify(webhook)}`);

    let messageText = 'Unsupported message type';
    const attachments: GhlPlatformMessage['attachments'] = [];
    const { data } = webhook;

    // Procesa el mensaje principal
    if (data.message) {
      if (data.message.conversation) {
        messageText = data.message.conversation;
      } else if (data.message.extendedTextMessage) {
        messageText = data.message.extendedTextMessage.text;
      }
      // Aquí puedes añadir más lógica para otros tipos de mensaje (imagen, video, etc.)
      // Por ejemplo, si hay un 'imageMessage', podrías procesar la URL y el caption.
    }

    // Placeholder para el timestamp, ya que el tipo corregido lo requiere.
    const timestamp = webhook.timestamp ? new Date(webhook.timestamp * 1000) : new Date();

    const platformMessage: GhlPlatformMessage = {
      direction: 'inbound',
      message: messageText.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp,
      // NOTA: Los campos `contactId` y `locationId` se añadirán en el ghl.service
      // después de encontrar o crear el contacto en GHL.
    };

    return platformMessage;
  }

  /**
   * Transforma un mensaje saliente de GoHighLevel a un formato que Evolution API entiende para enviarlo.
   * @param message El objeto de mensaje de GHL.
   * @returns Un objeto listo para ser enviado por el EvolutionService.
   */
  fromPlatformMessage(message: GhlPlatformMessage): any {
    this.logger.debug(`Transforming GHL message to Evolution API format: ${JSON.stringify(message)}`);

    // Lógica para enviar archivos si existen
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      return {
        // Asume que el `phone` viene en el objeto `message` desde el `ghl.service`
        phone: message.phone,
        options: {
          delay: 1200,
          presence: 'composing',
        },
        media: {
          url: attachment.url,
          caption: message.message,
        },
      };
    }

    // Lógica para enviar solo texto
    if (message.message) {
      return {
        phone: message.phone,
        text: message.message,
        options: {
          delay: 1200,
          presence: 'composing',
        },
      };
    }

    this.logger.warn('GHL message has neither text nor attachment. Cannot transform.');
    throw new Error('Empty GHL message cannot be sent.');
  }
}

