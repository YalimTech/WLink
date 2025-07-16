// src/prisma/prisma.service.ts

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma, User, Instance, InstanceState } from '@prisma/client';
import { StorageProvider } from '../core/base-adapter';

export function parseId(id: string | number | bigint): string {
  return id.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, StorageProvider<User, Instance, any, any> {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Successfully connected to the database.');
  }

  // --- MÉTODOS DE INSTANCIA ---

  // --- MÉTODO AÑADIDO PARA RESOLVER ERRORES ---
  async updateInstanceName(idInstance: string, name: string): Promise<Instance> {
    return this.instance.update({
      where: { idInstance: parseId(idInstance) },
      data: { name },
    });
  }
  
  // El resto de tus métodos (createUser, findUser, getInstance, etc.) pueden permanecer aquí...
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.user.upsert({ where: { id: data.id }, update: data, create: data });
  }

  async findUser(id: string): Promise<User | null> {
    return this.user.findUnique({ where: { id } });
  }

  async getInstance(idInstance: string): Promise<Instance | null> {
    return this.instance.findUnique({ where: { idInstance: parseId(idInstance) } });
  }

  // Y así sucesivamente con el resto de métodos que ya tenías...
}
