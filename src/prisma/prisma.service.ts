// src/prisma/prisma.service.ts

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma, User, Instance, InstanceState } from '@prisma/client';
import { StorageProvider } from '../core/base-adapter';

export function parseId(id: string | number | bigint): string {
  return id.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, StorageProvider<User, Instance & { user: User }, any, any> {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Successfully connected to the database.');
  }

  // --- MÉTODOS DE INSTANCIA ---

  // --- CORREGIDO: La firma ahora coincide con la interfaz StorageProvider ---
  async updateInstanceName(idInstance: string, name: string): Promise<Instance & { user: User }> {
    return this.instance.update({
      where: { idInstance: parseId(idInstance) },
      data: { name },
      include: { user: true },
    });
  }
  
  // El resto de los métodos necesarios para cumplir con la interfaz
  async createInstance(data: Prisma.InstanceCreateInput): Promise<Instance> {
    return this.instance.create({ data });
  }

  async updateInstanceState(idInstance: string, state: InstanceState): Promise<Instance> {
    return this.instance.update({ where: { idInstance: parseId(idInstance) }, data: { stateInstance: state } });
  }

  async updateInstanceSettings(idInstance: string, settings: Prisma.JsonValue): Promise<Instance> {
    return this.instance.update({ where: { idInstance: parseId(idInstance) }, data: { settings } });
  }

  // Métodos que ya tenías
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.user.upsert({ where: { id: data.id }, update: data, create: data });
  }

  async findUser(id: string): Promise<User | null> {
    return this.user.findUnique({ where: { id } });
  }

  async getInstance(idInstance: string): Promise<Instance | null> {
    return this.instance.findUnique({ where: { idInstance: parseId(idInstance) } });
  }
  
  async getInstancesByUserId(userId: string): Promise<Instance[]> {
    return this.instance.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
  
  async removeInstance(idInstance: string): Promise<Instance> {
    return this.instance.delete({ where: { idInstance: parseId(idInstance) } });
  }

  async getUserWithTokens(userId: string): Promise<User | null> {
    return this.user.findUnique({ where: { id: userId } });
  }

  async updateUserTokens(userId: string, accessToken: string, refreshToken: string, tokenExpiresAt: Date): Promise<User> {
    return this.user.update({ where: { id: userId }, data: { accessToken, refreshToken, tokenExpiresAt } });
  }
}
