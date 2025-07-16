// src/evolutionapi/index.ts

import { User, Instance, InstanceState, UserCreateData, UserUpdateData } from '../types';
import { Prisma } from '@prisma/client';

export interface Settings {
  [key: string]: any;
}

// --- Interfaces de Almacenamiento (StorageProvider) ---
export interface StorageProvider<U, V, C, D> {
  // Métodos de Usuario
  createUser(data: C): Promise<U>;
  findUser(identifier: string): Promise<U | null>;
  updateUser(identifier: string, data: D): Promise<U>;

  // Métodos de Instancia
  createInstance(data: any): Promise<V>;
  getInstance(idInstance: string): Promise<V | null>;
  getInstancesByUserId(userId: string): Promise<V[]>;
  removeInstance(idInstance: string): Promise<V>;
  updateInstanceName(idInstance: string, name: string): Promise<V>;
  updateInstanceState(idInstance: string, state: InstanceState): Promise<V>;
  updateInstanceSettings(idInstance: string, settings: Settings): Promise<V>;
}

// --- Interfaces de Transformación de Mensajes ---
export interface MessageTransformer<T, U> {
  toPlatformMessage(payload: U): T;
  fromPlatformMessage(message: T): any;
}

// --- Interfaces de Errores Personalizados ---
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationError';
  }
}
