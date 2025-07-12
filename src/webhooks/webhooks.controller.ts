import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { Response, Request } from "express";
import { GhlService } from "../ghl/ghl.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Controller("webhooks")
export class WebhooksController {
  constructor(
    private readonly ghlService: GhlService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("evolution")
  @HttpCode(HttpStatus.OK)
  async handleEvolutionWebhook(@Body() payload: any, @Res() res: Response): Promise<void> {
    console.log("Evolution API Webhook Payload:", JSON.stringify(payload));
    res.status(HttpStatus.OK).send();

    try {
      // Detectamos si es un mensaje entrante
      if (payload?.type === "message:received" && payload?.message?.from) {
        const from = payload.message.from;
        const body = payload.message.text || "";
        const phoneNumber = this.normalizePhoneNumber(from);

        // 🔍 Buscar instancia que maneja ese número
        const instance = await this.prisma.instance.findFirst({
          where: {
            phoneNumber,
          },
        });

        if (!instance) {
          console.warn("No instance found for number", phoneNumber);
          return;
        }

        // 📲 Buscar contacto en GHL
        const contact = await this.ghlService.getGhlContactByPhone(instance.userId, phoneNumber);

        if (!contact || !contact.id) {
          console.warn("No GHL contact found or created");
          return;
        }

        // 🚀 Reenviar mensaje a GHL como mensaje inbound
        await this.ghlService.sendInboundMessageToGhl({
          locationId: instance.userId,
          message: {
            contactId: contact.id,
            locationId: instance.userId,
            message: body,
            direction: "inbound",
            conversationProviderId: this.configService.get(
              "GHL_CONVERSATION_PROVIDER_ID",
            ),
          },
        });
      }
    } catch (error) {
      console.error("Error processing Evolution webhook", error);
    }
  }

  @Post("ghl")
  @HttpCode(HttpStatus.OK)
  async handleGhlWebhook(@Body() ghlWebhook: any, @Req() request: Request, @Res() res: Response): Promise<void> {
    const locationId = ghlWebhook.locationId || request.headers["x-location-id"];
    const messageId = ghlWebhook.messageId;
    try {
      const conversationProviderId =
        ghlWebhook.conversationProviderId === this.configService.get("GHL_CONVERSATION_PROVIDER_ID");

      if (!conversationProviderId) throw new BadRequestException("Conversation provider ID is wrong");
      if (!locationId) throw new BadRequestException("Location ID is missing");

      let instanceId: string | bigint | null = null;

      const contact = await this.ghlService.getGhlContact(locationId, ghlWebhook.phone);
      if (contact?.tags) {
        instanceId = this.extractInstanceIdFromTags(contact.tags);
      }

      if (!instanceId) {
        const instances = await this.prisma.getInstancesByUserId(locationId);
        if (instances.length === 0) return;
        instanceId = instances.length === 1
          ? instances[0].idInstance
          : instances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0].idInstance;
      }

      res.status(HttpStatus.OK).send();

      if (ghlWebhook.type === "SMS" && (ghlWebhook.message || (ghlWebhook.attachments?.length > 0))) {
        await this.ghlService.handlePlatformWebhook(ghlWebhook, BigInt(instanceId));
      }

    } catch (error) {
      console.error("Error processing GHL webhook for location", locationId, error);
      if (locationId && messageId) {
        await this.ghlService.updateGhlMessageStatus(locationId, messageId, "failed", {
          code: "500",
          type: "message_processing_error",
          message: error.message || "Failed to process outbound message",
        });
      }
      res.status(HttpStatus.OK).send();
    }
  }

  private normalizePhoneNumber(number: string): string {
    return number.replace(/[^0-9]/g, ""); // Elimina espacios, guiones, paréntesis
  }

  private extractInstanceIdFromTags(tags: string[]): string | null {
    const instanceTag = tags.find(tag => tag.startsWith("whatsapp-instance-"));
    return instanceTag ? instanceTag.replace("whatsapp-instance-", "") : null;
  }
}
