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

// --- Interfaces para Webhooks de Evolution API (CORREGIDO Y COMPLETO) ---
export interface MessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}
export interface MessageData {
  key: MessageKey;
  pushName?: string;
  message?: { conversation?: string; extendedTextMessage?: { text: string } };
  messageTimestamp: number;
}
export interface EvolutionWebhook {
  event: string;
  instance: string;
  data: MessageData;
  sender: string;
  // --- CAMPOS AÑADIDOS PARA RESOLVER ERRORES ---
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
  // --- CAMPO AÑADIDO PARA RESOLVER ERRORES ---
  fileName?: string;
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
export interface GhlContact {
  id: string;
  name: string;
  locationId: string;
  phone: string;
  tags: string[];
}

