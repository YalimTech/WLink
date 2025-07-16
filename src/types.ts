// src/types.ts

import { Request } from 'express';
import { Prisma, User as PrismaUser, Instance as PrismaInstance } from '@prisma/client';

export { InstanceState } from '@prisma/client';
export type User = PrismaUser;
export type Instance = PrismaInstance;

// --- DTOs (Data Transfer Objects) ---
export interface CreateInstanceDto {
  locationId: string;
  instanceId: string;
  apiToken: string;
  name?: string;
}
export interface UpdateInstanceDto {
  name: string;
}

// --- Tipos de Prisma ---
export type UserCreateData = Prisma.UserCreateInput;
export type UserUpdateData = Prisma.UserUpdateInput;

// --- Interfaces para Webhooks de Evolution API ---
export interface MessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}
export interface MessageData {
  key: MessageKey;
  pushName?: string;
  message?: { conversation?: string; extendedTextMessage?: { text: string }; [key: string]: any; };
  messageTimestamp: number;
  [key: string]: any;
}
export interface EvolutionWebhook {
  event: string;
  instance: string;
  data: MessageData;
  sender: string;
  // --- CAMPOS AÑADIDOS PARA RESOLVER ERRORES DE INCOMPATIBILIDAD ---
  type?: string;
  timestamp?: number;
}

// --- Interfaces para GoHighLevel (GHL) ---
export interface AuthReq extends Request {
  locationId: string;
}
export interface GhlUserData {
  userId: string;
  companyId: string;
  type: 'location' | 'agency';
}
export interface GhlPlatformAttachment {
  url: string;
  fileName?: string;
  type?: string; // Campo añadido para resolver error
}
export interface MessageStatusPayload {
  status?: 'delivered' | 'read' | 'failed' | 'pending';
  error?: any;
}
export interface GhlPlatformMessage {
  contactId?: string;
  locationId: string;
  message: string;
  direction: 'inbound' | 'outbound';
  conversationProviderId?: string;
  attachments?: GhlPlatformAttachment[];
  timestamp?: Date;
}
// --- CORREGIDO: Resuelve errores de importación ---
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

