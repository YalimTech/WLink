import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma, User, Instance, InstanceState } from '@prisma/client';
import { StorageProvider } from '../core/base-adapter'; // Asegúrate de que esta ruta sea correcta

export function parseId(id: string | number | bigint): string {
  return id.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, StorageProvider<User, Instance, Prisma.UserCreateInput, Prisma.UserUpdateInput>
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Successfully connected to the database.');
  }

  // --- Métodos de Usuario (sin cambios) ---
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.user.upsert({ where: { id: data.id }, update: data, create: data });
  }

  async findUser(id: string): Promise<User | null> {
    return this.user.findUnique({ where: { id } });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.user.update({ where: { id }, data });
  }

  async getUserWithTokens(userId: string): Promise<User | null> {
    return this.user.findUnique({ where: { id: userId } });
  }

  async updateUserTokens(userId: string, accessToken: string, refreshToken: string, tokenExpiresAt: Date): Promise<User> {
    return this.user.update({ where: { id: userId }, data: { accessToken, refreshToken, tokenExpiresAt } });
  }

  // --- Métodos de Instancia (Simplificados) ---
  async getInstance(idInstance: string): Promise<Instance | null> {
    return this.instance.findUnique({ where: { idInstance: parseId(idInstance) } });
  }

  async getInstancesByUserId(userId: string): Promise<Instance[]> {
    return this.instance.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async removeInstance(idInstance: string): Promise<Instance> {
    return this.instance.delete({ where: { idInstance: parseId(idInstance) } });
  }
  
  // --- MÉTODOS AÑADIDOS PARA RESOLVER ERROR DE GUARD ---
  // Estos métodos satisfacen la interfaz que el `BaseEvolutionApiAuthGuard` espera.
  async createInstance(data: Prisma.InstanceCreateInput): Promise<Instance> {
    return this.instance.create({ data });
  }

  async updateInstanceState(idInstance: string, state: InstanceState): Promise<Instance> {
    return this.instance.update({ where: { idInstance: parseId(idInstance) }, data: { stateInstance: state } });
  }

  async updateInstanceSettings(idInstance: string, settings: Prisma.JsonValue): Promise<Instance> {
    return this.instance.update({ where: { idInstance: parseId(idInstance) }, data: { settings } });
  }
}

