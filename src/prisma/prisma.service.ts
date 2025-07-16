import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma, User, Instance, InstanceState } from '@prisma/client';
import { StorageProvider } from '../core/base-adapter';

/**
 * Normaliza IDs a strings para consistencia con el esquema de Prisma.
 */
export function parseId(id: string | number | bigint): string {
  return id.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, StorageProvider<User, Instance & { user: User }, UserCreateData, UserUpdateData>
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Successfully connected to the database.');
  }

  // --- MÉTODOS DE USUARIO ---

  async createUser(data: UserCreateData): Promise<User> {
    return this.user.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  async findUser(id: string): Promise<User | null> {
    return this.user.findUnique({ where: { id } });
  }

  async updateUser(id: string, data: UserUpdateData): Promise<User> {
    return this.user.update({ where: { id }, data });
  }

  async getUserWithTokens(userId: string): Promise<User | null> {
    return this.user.findUnique({ where: { id: userId } });
  }

  async updateUserTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date,
  ): Promise<User> {
    return this.user.update({
      where: { id: userId },
      data: { accessToken, refreshToken, tokenExpiresAt },
    });
  }

  // --- MÉTODOS DE INSTANCIA ---

  async createInstance(data: Prisma.InstanceCreateInput): Promise<Instance & { user: User }> {
    return this.instance.create({
      data,
      include: { user: true },
    });
  }

  async getInstance(idInstance: string): Promise<(Instance & { user: User }) | null> {
    return this.instance.findUnique({
      where: { idInstance: parseId(idInstance) },
      include: { user: true },
    });
  }

  async getInstancesByUserId(userId: string): Promise<(Instance & { user: User })[]> {
    return this.instance.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  async removeInstance(idInstance: string): Promise<Instance & { user: User }> {
    // Prisma no devuelve el objeto en delete, así que lo buscamos antes para devolverlo.
    const instanceToRemove = await this.getInstance(idInstance);
    if (!instanceToRemove) {
      throw new Error(`Instance ${idInstance} not found for deletion.`);
    }
    await this.instance.delete({
      where: { idInstance: parseId(idInstance) },
    });
    return instanceToRemove;
  }

  // --- MÉTODOS DE ACTUALIZACIÓN DE INSTANCIA ---

  async updateInstanceName(idInstance: string, name: string): Promise<Instance & { user: User }> {
    return this.instance.update({
      where: { idInstance: parseId(idInstance) },
      data: { name },
      include: { user: true },
    });
  }

  async updateInstanceState(idInstance: string, state: InstanceState): Promise<Instance & { user: User }> {
    return this.instance.update({
      where: { idInstance: parseId(idInstance) },
      data: { stateInstance: state },
      include: { user: true },
    });
  }

  async updateInstanceSettings(idInstance: string, settings: Prisma.JsonValue): Promise<Instance & { user: User }> {
    return this.instance.update({
      where: { idInstance: parseId(idInstance) },
      data: { settings },
      include: { user: true },
    });
  }
}
