import { Injectable, Logger } from "@nestjs/common";
import { GhlWebhookDto } from "./dto/ghl-webhook.dto";
import { GhlPlatformMessage } from "../types";
import { MessageTransformer, Message } from "../types/message.interface";
import { EvolutionWebhook } from "../types/evolution-webhook.interface";
import { extractPhoneNumberFromVCard } from "../utils/format";

@Injectable()
export class GhlTransformer implements MessageTransformer<GhlWebhookDto, GhlPlatformMessage> {
  private readonly logger = new Logger(GhlTransformer.name);

  toPlatformMessage(webhook: EvolutionWebhook): GhlPlatformMessage {
    this.logger.debug(`Transforming Evolution API webhook to GHL Platform Message: ${JSON.stringify(webhook)}`);

    let messageText = "";
    const attachments: GhlPlatformMessage["attachments"] = [];


    if (webhook.type === "message") {
      const isGroup = webhook.data?.from?.endsWith("@g.us") || false;
      const senderName = webhook.data?.senderName || "Unknown";
      const senderNumber = webhook.data?.from || "unknown";
      const msgData = webhook.data?.message;

      switch (msgData.type) {
        case "text":
          messageText = msgData.text?.body || "";
          break;

        case "image":
        case "video":
        case "document":
        case "audio":
          messageText = msgData.caption || `📎 ${msgData.type} received`;
          if (msgData.url) {
            attachments.push({
              url: msgData.url,
              fileName: msgData.filename || `${Date.now()}-${msgData.type}`,
              type: msgData.mimetype || "application/octet-stream",
            });
          }
          break;

        case "sticker":
          messageText = msgData.caption || "🟡 Sticker received";
          if (msgData.url) {
            attachments.push({
              url: msgData.url,
              fileName: msgData.filename || "sticker.webp",
              type: msgData.mimetype || "image/webp",
            });
          }
          break;
        case "location":
          const loc = msgData.location;
          messageText = [
            "📍 Location shared:",
            loc.name && `Name: ${loc.name}`,
            loc.address && `Address: ${loc.address}`,
            `Map: https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
          ]
            .filter(Boolean)
            .join("\n");
          break;

        case "contact":
          const contact = msgData.contact;
          const phone = extractPhoneNumberFromVCard(contact?.vcard || "");
          messageText = [
            "👤 Contact shared:",
            contact.displayName && `Name: ${contact.displayName}`,
            phone && `Phone: ${phone}`,
          ]
            .filter(Boolean)
            .join("\n");
          break;

        default:
          this.logger.warn(`Unsupported message type from Evolution API: ${msgData.type}`);
          messageText = "❔ Unsupported message type received.";
      }

      if (isGroup) {
        messageText = `${senderName} (+${senderNumber.replace("@g.us", "")}):\n\n${messageText}`;
      }

      return {
        contactId: "placeholder_ghl_contact_id",
        locationId: "placeholder_ghl_location_id",
        message: messageText.trim(),
        direction: "inbound",
        attachments: attachments.length > 0 ? attachments : undefined,
        timestamp: new Date(webhook.timestamp),
      };
    }


    if (webhook.type === "incomingCall") {
      const caller = webhook.from?.replace("@c.us", "") || "unknown";
      const status = webhook.call?.status || "unknown";

      switch (status) {
        case "offer":
          messageText = `📞 Incoming call from ${caller}`;
          break;
        case "answered":
          messageText = `✅ Call answered by ${caller}`;
          break;
        case "rejected":
          messageText = `❌ Call rejected by ${caller}`;
          break;
        case "missed":
          messageText = `🔕 Missed call from ${caller}`;
          break;
        default:
          messageText = `📞 Call event from ${caller} - Status: ${status}`;
      }

      return {
        contactId: "placeholder_ghl_contact_id",
        locationId: "placeholder_ghl_location_id",
        message: messageText,
        direction: "inbound",
        timestamp: new Date(webhook.timestamp),
      };
    }

    this.logger.error(`Unsupported webhook type received from Evolution API: ${webhook.type}`);
    return {
      contactId: "error_contact_id",
      locationId: "error_location_id",
      message: `❌ Error: Unsupported webhook type '${webhook.type}' received.`,
      direction: "inbound",
    };
  }


  toEvolutionApiMessage(ghlWebhook: GhlWebhookDto): Message {
    this.logger.debug(`Transforming GHL Webhook to Evolution API Message: ${JSON.stringify(ghlWebhook)}`);

    if (ghlWebhook.type === "SMS" && ghlWebhook.phone) {
      const isGroup = ghlWebhook.phone.length > 16;
      const chatId = isGroup
        ? `${ghlWebhook.phone}@g.us`
        : `${ghlWebhook.phone}@c.us`;

      if (ghlWebhook.attachments?.length) {
        const fileUrl = ghlWebhook.attachments[0];
        return {
          type: "url-file",
          chatId,
          file: {
            url: fileUrl,
            fileName: `${Date.now()}_${ghlWebhook.messageId || "file"}`,
          },
          caption: ghlWebhook.message || "",
        };
      }

      if (ghlWebhook.message) {
        return {
          type: "text",
          chatId,
          message: ghlWebhook.message,
        };
      }

      this.logger.warn(`GHL webhook has neither message nor attachment for phone: ${ghlWebhook.phone}`);
      throw new Error(`Empty GHL message for phone ${ghlWebhook.phone}`);
    }

    this.logger.error(`Unsupported GHL webhook type: ${ghlWebhook.type}`);
    throw new Error(`Unsupported GHL webhook type: ${ghlWebhook.type}`);
  }
}

