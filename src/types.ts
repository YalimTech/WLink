import { Request } from 'express';
// Importa los tipos directamente de Prisma para mantenerlos siempre sincronizados
import { Prisma, User as PrismaUser, Instance as PrismaInstance } from '@prisma/client';

export { InstanceState } from '@prisma/client';

// Re-exportamos los tipos de Prisma para que otros archivos puedan importarlos desde aquí
export type User = PrismaUser;
export type Instance = PrismaInstance;

// --- DTOs (Data Transfer Objects) para el Controlador ---
// Estos definen la forma de los datos que se reciben en las peticiones HTTP

export interface CreateInstanceDto {
  locationId: string;
  instanceId: string;
  apiToken: string;
  name?: string;
}

export interface UpdateInstanceDto {
  name: string;
}

// --- Tipos para la creación y actualización de datos en Prisma (CORREGIDO) ---
// Esto resuelve los errores de importación en `prisma.service.ts`
export type UserCreateData = Prisma.UserCreateInput;
export type UserUpdateData = Prisma.UserUpdateInput;


// --- Interfaces para Webhooks de Evolution API (CORREGIDO Y COMPLETO) ---
// Esta es la corrección más importante. Define la estructura real del webhook.

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
  sender: string; // El número de teléfono que envía el webhook
}


// --- Interfaces para GoHighLevel (GHL) ---

export interface AuthReq extends Request {
  locationId: string;
}

export interface GhlPlatformAttachment {
  url: string;
  fileName?: string;
  type?: string;
}

export interface GhlPlatformMessage {
  contactId?: string;
  locationId: string;
  message: string;
  direction: 'inbound' | 'outbound';
  conversationProviderId?: string;
  attachments?: GhlPlatformAttachment[];
}

// --- Interfaces para Contactos de GHL (Simplificado y Correcto) ---

export interface GhlContactUpsertRequest {
  name?: string | null;
  locationId: string;
  phone?: string | null;
  tags?: string[];
  source?: string;
}

export interface GhlContact {
  id: string;
  name: string;
  locationId: string;
  phone: string;
  tags: string[];
}

export interface GhlContactUpsertResponse {
  contact: GhlContact;
}


