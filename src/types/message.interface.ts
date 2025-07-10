export type EvolutionMessageType = "text" | "url-file" | "location" | "image" | "audio" | "video" | "document";

export interface EvolutionApiMessage {
  type: EvolutionMessageType;
  chatId: string;
  message?: string;
  file?: {
    url: string;
    fileName?: string;
  };
  caption?: string;
}

export interface MessageTransformer<PlatformMessage, WebhookPayload> {
  toPlatformMessage(payload: WebhookPayload): PlatformMessage;
  toEvolutionApiMessage(platformMessage: PlatformMessage): EvolutionApiMessage;
}
