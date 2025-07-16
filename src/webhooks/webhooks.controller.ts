import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
  Logger, // Importa Logger
} from "@nestjs/common";
import { Response, Request } from "express";
import { GhlService } from "../ghl/ghl.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { GhlWebhookDto } from "../ghl/dto/ghl-webhook.dto"; // Asegúrate de importar el DTO

@Controller("webhooks")
export class WebhooksController {
  // Añade un logger para mejor depuración
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly ghlService: GhlService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("evolution")
  @HttpCode(HttpStatus.OK)
  // Futuro: Aquí deberías añadir un Guard para verificar el token del webhook
  async handleEvolutionWebhook(@Body() payload: any, @Res() res: Response): Promise<void> {
    this.logger.log(`Evolution API Webhook Payload: ${JSON.stringify(payload)}`);
    res.status(HttpStatus.OK).send(); // Responde inmediatamente para no bloquear a Evolution API

    try {
      // La clave 'instance' puede variar según la configuración de tu Evolution API. Ajústala si es necesario.
      const instanceId = payload.instance; 
      
      if (!instanceId) {
        this.logger.warn('Webhook received without instance ID. Ignoring.');
        return;
      }
      
      // Delegamos toda la lógica compleja al servicio
      await this.ghlService.handleEvolutionWebhook(payload, instanceId);

    } catch (error) {
      this.logger.error(`Error processing Evolution webhook: ${error.message}`, error.stack);
    }
  }

  @Post("ghl")
  @HttpCode(HttpStatus.OK)
  async handleGhlWebhook(@Body() ghlWebhook: GhlWebhookDto, @Req() request: Request, @Res() res: Response): Promise<void> {
    const locationId = ghlWebhook.locationId || request.headers["x-location-id"] as string;
    const messageId = ghlWebhook.messageId;
    
    this.logger.debug(`GHL Webhook Body: ${JSON.stringify(ghlWebhook)}`);

    try {
      const conversationProviderId =
        ghlWebhook.conversationProviderId === this.configService.get("GHL_CONVERSATION_PROVIDER_ID");

      if (!conversationProviderId) {
        throw new BadRequestException("Conversation provider ID is wrong");
      }
      if (!locationId) {
        throw new BadRequestException("Location ID is missing");
      }

      let instanceId: string | null = null;

      const contact = await this.ghlService.getGhlContactByPhone(locationId, ghlWebhook.phone);
      
      if (contact?.tags) {
        instanceId = this.extractInstanceIdFromTags(contact.tags);
      }

      if (!instanceId) {
        const instances = await this.prisma.getInstancesByUserId(locationId);
        if (instances.length === 0) {
            this.logger.warn(`No instances found for location ${locationId}, cannot process outgoing message.`);
            res.status(HttpStatus.OK).send(); // Responde OK para evitar reintentos de GHL
            return;
        }
        instanceId = instances.length === 1
          ? instances[0].idInstance
          : instances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0].idInstance;
      }
      
      res.status(HttpStatus.OK).send(); // Envía la respuesta antes de procesar

      if (ghlWebhook.type === "SMS" && (ghlWebhook.message || (ghlWebhook.attachments?.length > 0))) {
        await this.ghlService.handlePlatformWebhook(ghlWebhook, instanceId as string);
      }

    } catch (error) {
      this.logger.error(`Error processing GHL webhook for location ${locationId}: ${error.message}`, error.stack);
      if (locationId && messageId) {
        await this.ghlService.updateGhlMessageStatus(locationId, messageId, "failed", {
          code: "500",
          type: "message_processing_error",
          message: error.message || "Failed to process outbound message",
        });
      }
      // Asegurarse de que siempre se responda, incluso en caso de error.
      if (!res.headersSent) {
        res.status(HttpStatus.OK).send();
      }
    }
  }

  private extractInstanceIdFromTags(tags: string[]): string | null {
    if (!tags || tags.length === 0) return null;
    const instanceTag = tags.find(tag => tag.startsWith("whatsapp-instance-"));
    return instanceTag ? instanceTag.replace("whatsapp-instance-", "") : null;
  }
}
