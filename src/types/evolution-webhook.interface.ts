export interface EvolutionWebhook {
  type: "message" | "incomingCall" | string;
  timestamp: number;
  from?: string;
  call?: {
    status: "offer" | "answered" | "rejected" | "missed" | string;
  };
  data?: {
    from?: string;
    senderName?: string;
    message?: {
      type:
        | "text"
        | "image"
        | "video"
        | "document"
        | "audio"
        | "sticker"
        | "location"
        | "contact"
        | string;
      text?: {
        body: string;
      };
      caption?: string;
      filename?: string;
      mimetype?: string;
      url?: string;
      location?: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
      };
      contact?: {
        displayName?: string;
        vcard?: string;
      };
    };
  };
}
