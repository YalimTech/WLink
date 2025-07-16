import { Request } from 'express';
// Importa los tipos directamente de Prisma para mantenerlos siempre sincronizados
export { User, Instance, InstanceState } from '@prisma/client';

// --- Interfaces para los DTOs del controlador ---

export interface CreateInstanceDto {
  locationId: string;
  instanceId: string;
  apiToken: string;
  name?: string;
}

export interface UpdateInstanceDto {
  name: string;
}

// --- Interfaces para Webhooks de Evolution API ---

export interface MessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

export interface MessageData {
  key: MessageKey;
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    // Aquí puedes añadir otros tipos de mensajes que esperes, como imageMessage, etc.
  };
  messageTimestamp: number;
}

export interface EvolutionWebhook {
  event: 'messages.upsert' | 'connection.update' | string;
  instance: string;
  data: MessageData;
  sender: string;
}

// --- Interfaces para GoHighLevel (GHL) ---

export interface AuthReq extends Request {
  locationId: string;
}

interface GhlPlatformAttachment {
  url: string;
  fileName?: string;
  type?: string;
}

export interface MessageStatusPayload {
  status?: 'delivered' | 'read' | 'failed' | 'pending';
  code?: string;
  type?: string;
  message?: string;
  [key: string]: any;
}

export interface SendResponse {
  id?: string;
  status?: string;
  [key: string]: any;
}

export interface GhlUserData {
  userId: string;
  companyId: string;
  role: string;
  type: 'location' | 'agency';
  userName: string;
  email: string;
  activeLocation: string;
}

export interface GhlPlatformMessage {
  contactId?: string;
  locationId: string;
  message: string;
  direction: 'inbound' | 'outbound';
  conversationProviderId?: string;
  attachments?: GhlPlatformAttachment[];
  timestamp?: Date;
  phone?: string;
  type?: string;
  messageId?: string;
}

interface GhlDndSettings {
  // ... (Esta interfaz parece correcta, la mantenemos)
}

// --- Interfaces para Contactos de GHL ---

export interface GhlContactUpsertRequest {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  locationId: string;
  phone?: string | null;
  tags?: string[];
  source?: string;
  companyName?: string | null;
  // ... (puedes añadir otros campos si los necesitas)
}

export interface GhlContact {
  id: string;
  name: string;
  locationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string[];
  // ... (otros campos que te interesen de la respuesta de GHL)
}

export interface GhlContactUpsertResponse {
  new: boolean;
  contact: GhlContact;
  traceId: string;
}


