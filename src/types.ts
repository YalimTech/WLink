import { Request } from 'express';
import { Prisma, User as PrismaUser, Instance as PrismaInstance } from '@prisma/client';

// Re-exportamos los tipos de Prisma para que otros archivos los usen desde aquí
export { InstanceState } from '@prisma/client';
export type User = PrismaUser;
export type Instance = PrismaInstance;

// --- DTOs (Data Transfer Objects) para las peticiones HTTP ---
export interface CreateInstanceDto {
  locationId: string;
  instanceId: string;
  apiToken: string;
  name?: string;
}

export interface UpdateInstanceDto {
  name: string;
}

// --- Tipos para la creación y actualización en Prisma (Resuelve errores en prisma.service) ---
export type UserCreateData = Prisma.UserCreateInput;
export type UserUpdateData = Prisma.UserUpdateInput;

// --- Interfaces para Webhooks de Evolution API (CORREGIDO) ---
// Define la estructura REAL que envía Evolution API para que no haya errores de "propiedad no existe"
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
    extendedTextMessage?: { text: string };
    // Añadir otros tipos de mensaje aquí si es necesario (imageMessage, etc.)
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

// Resuelve el error de importación en el ghl-context.guard.ts
export interface GhlUserData {
  userId: string;
  companyId: string;
  type: 'location' | 'agency';
  // ...otros campos necesarios
}

export interface GhlPlatformAttachment {
  url: string;
}

// Resuelve el error de importación en ghl.service.ts
export interface MessageStatusPayload {
  status?: 'delivered' | 'read' | 'failed' | 'pending';
  error?: any;
}

// Resuelve el error del "timestamp" en ghl.transformer.ts
export interface GhlPlatformMessage {
  contactId?: string;
  locationId: string;
  message: string;
  direction: 'inbound' | 'outbound';
  conversationProviderId?: string;
  attachments?: GhlPlatformAttachment[];
  timestamp?: Date; // Campo añadido
}

// --- Interfaces para Contactos de GHL ---

export interface GhlContactUpsertRequest {
  name?: string;
  locationId: string;
  phone?: string;
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

