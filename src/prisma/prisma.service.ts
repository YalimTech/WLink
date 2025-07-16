import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma, User, Instance } from '@prisma/client';

/**
 * Normaliza los IDs numéricos a strings para que coincidan con el esquema de Prisma.
 * Exportado para su uso en toda la base de código.
 */
export function parseId(id: string | number | bigint): string {
  return id.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to the database.');
    } catch (error) {
      this.logger.error('Failed to connect to the database.', error.stack);
      throw error;
    }
  }

  // --- Métodos de Usuario ---

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.user.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
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

  // --- Métodos de Instancia ---

  async getInstance(idInstance: string): Promise<(Instance & { user: User }) | null> {
    return this.instance.findUnique({
      where: { idInstance: parseId(idInstance) },
      include: { user: true },
    });
  }

  async getInstancesByUserId(userId: string): Promise<Instance[]> {
    return this.instance.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeInstance(idInstance: string): Promise<Instance> {
    return this.instance.delete({
      where: { idInstance: parseId(idInstance) },
    });
  }

  async updateInstanceName(idInstance: string, name: string): Promise<Instance> {
    return this.instance.update({
      where: { idInstance: parseId(idInstance) },
      data: { name },
    });
  }
}

