// src/types.ts

import { Request } from 'express';

export enum InstanceState {
  notAuthorized = 'notAuthorized',
  authorized = 'authorized',
  yellowCard = 'yellowCard',
  blocked = 'blocked',
  starting = 'starting',
}

export interface User {
  id: string;
  companyId?: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt?: Date | null;
}

export interface Instance {
  id: bigint;
  idInstance: string;
  name?: string | null;
  apiTokenInstance: string;
  stateInstance?: InstanceState | null;
  userId: string;
  settings?: any;
  createdAt?: Date;
}

// --- DTOs (Data Transfer Objects) para las peticiones HTTP ---
export interface CreateInstanceDto {
  locationId: string;
  instanceId: string; // Corregido: de instanceName a instanceId
  apiToken: string;
  name?: string;
}
export interface UpdateInstanceDto {
  name: string;
}

// --- Tipos para la creación y actualización en Prisma ---
export interface UserCreateData extends User {}
export interface UserUpdateData extends Partial<User> {}

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
  type?: string;
  timestamp?: number;
}

// --- Interfaces para GoHighLevel (GHL) ---
export interface AuthReq extends Request {
  locationId: string;
  // Agregando userData opcional para que esté disponible en el request si es necesario
  userData?: GhlUserData; 
}

export interface GhlUserData {
  userId: string;
  companyId: string;
  type: 'location' | 'agency';
  // Agregando activeLocation para que coincida con el uso en el guard
  activeLocation?: string; 
  locationId?: string;
}

export interface GhlPlatformAttachment {
  url: string;
  fileName?: string;
  type?: string;
}
export interface MessageStatusPayload {
  status?: 'delivered' | 'read' | 'failed' | 'pending' | 'sent';
  error?: any;
}
export interface GhlPlatformMessage {
  contactId?: string;
  locationId: string;
  phone?: string;
  message: string;
  direction: 'inbound' | 'outbound';
  attachments?: GhlPlatformAttachment[];
  timestamp?: Date;
}
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

