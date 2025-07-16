import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StorageProvider, Settings } from '../evolutionapi';
import {
  InstanceState,
  User,
  Instance,
  UserCreateData,
  UserUpdateData,
} from '../types';


export function parseId(id: string | number): string {

  return typeof id === 'string' ? id : id.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, StorageProvider<User, Instance, UserCreateData, UserUpdateData>
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    let dbUrl = (process.env.DATABASE_URL || '').trim();

    // Remove quotes if present
    if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
      dbUrl = dbUrl.slice(1, -1);
      process.env.DATABASE_URL = dbUrl;
    }

    // Validate protocol
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      throw new Error(
        'Invalid DATABASE_URL. Must start with "postgresql://" or "postgres://"',
      );
    }

    super();
  }

  async onModuleInit() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://'))) {
      this.logger.error('Invalid DATABASE_URL. Must start with "postgresql://" or "postgres://"');
      throw new Error('Invalid DATABASE_URL');
    }

    const retries = parseInt(process.env.DB_CONNECT_RETRIES || '5', 10);
    const delayMs = parseInt(process.env.DB_CONNECT_DELAY_MS || '2000', 10);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Connected to database');
        return;
      } catch (err) {
        if (attempt === retries) {
          this.logger.error('Unable to connect to database', err as Error);
          throw err;
        }
        this.logger.warn(`Connection attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }

  async createUser(data: UserCreateData): Promise<User> {
    if (!data.id) {
      throw new Error('Missing user ID for createUser()');
    }

    try {
      const user = await this.user.upsert({
        where: { id: data.id },
        update: data as any,
        create: data as any,
      });
      this.logger.log(`User upserted with ID ${user.id}`);
      return user as User;
    } catch (err) {
      this.logger.error(`Error creating user ${data.id}: ${(err as Error).message}`);
      throw err;
    }
  }

  async findUser(identifier: string): Promise<User | null> {
    return this.user.findUnique({ where: { id: identifier } });
  }

  async updateUser(identifier: string, data: UserUpdateData): Promise<User> {
    try {
      const user = await this.user.update({
        where: { id: identifier },
        data: data as any,
      });
      this.logger.log(`User ${identifier} updated`);
      return user as User;
    } catch (err) {
      this.logger.error(`Error updating user ${identifier}: ${(err as Error).message}`);
      throw err;
    }
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
    try {
      const user = await this.user.update({
        where: { id: userId },
        data: { accessToken, refreshToken, tokenExpiresAt } as any,
      });
      this.logger.log(`Tokens updated for user ${userId}`);
      return user as User;
    } catch (err) {
      this.logger.error(`Error updating tokens for user ${userId}: ${(err as Error).message}`);
      throw err;
    }
  }

  async createInstance(instanceData: any): Promise<Instance> {
    const ghlLocationId = instanceData.user?.connect?.id;
    const stateInstance = instanceData.stateInstance;
    const idInstance = parseId(instanceData.idInstance);

    if (!ghlLocationId) {
      throw new Error(
        'userId (GHL Location ID as string) is required on the instance data to create an Instance.',
      );
    }

    const userExists = await this.user.findUnique({
      where: { id: ghlLocationId },
    });

    if (!userExists) {
      throw new NotFoundException(
        `User (GHL Location) with ID ${ghlLocationId} not found. Cannot create instance.`,
      );
    }

    try {
      const instance = await this.instance.upsert({
        where: { idInstance },
        update: {
          apiTokenInstance: instanceData.apiTokenInstance,
          stateInstance: stateInstance || InstanceState.notAuthorized,
          settings: instanceData.settings || {},
          name: instanceData.name,
          phoneNumber: instanceData.phoneNumber,
          user: { connect: { id: ghlLocationId } },
        } as any,
        create: {
          idInstance,
          apiTokenInstance: instanceData.apiTokenInstance,
          stateInstance: stateInstance || InstanceState.notAuthorized,
          settings: instanceData.settings || {},
          name: instanceData.name,
          phoneNumber: instanceData.phoneNumber,
          user: { connect: { id: ghlLocationId } },
        } as any,
      });
      this.logger.log(`Instance ${instance.idInstance} created/updated for user ${ghlLocationId}`);
      return instance as any;
    } catch (err) {
      this.logger.error(`Failed to create instance ${idInstance}: ${(err as Error).message}`);
      throw err;
    }
  }

  async getInstance(idInstance: string | number): Promise<(Instance & { user: User }) | null> {
    return (await this.instance.findUnique({
      where: { idInstance: parseId(idInstance) },
      include: { user: true },
    })) as unknown as (Instance & { user: User }) | null;
  }

  async getInstancesByUserId(userId: string): Promise<Instance[]> {
    return (await this.instance.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })) as unknown as Instance[];
  }

  async removeInstance(idInstance: string | number): Promise<Instance> {
    try {
      const instance = await this.instance.delete({
        where: { idInstance: parseId(idInstance) },
      });
      this.logger.log(`Instance ${instance.idInstance} removed`);
      return instance as any;
    } catch (err) {
      this.logger.error(`Error removing instance ${idInstance}: ${(err as Error).message}`);
      throw err;
    }
  }

  async updateInstanceSettings(idInstance: string | number, settings: Settings): Promise<Instance> {
    try {
      const instance = await this.instance.update({
        where: { idInstance: parseId(idInstance) },
        data: { settings: settings || {} },
      });
      this.logger.log(`Settings updated for instance ${instance.idInstance}`);
      return instance as any;
    } catch (err) {
      this.logger.error(`Error updating settings for instance ${idInstance}: ${(err as Error).message}`);
      throw err;
    }
  }

  async updateInstanceState(idInstance: string | number, state: InstanceState): Promise<Instance> {
    try {
      const instance = await this.instance.update({
        where: { idInstance: parseId(idInstance) },
        data: { stateInstance: state },
      });
      this.logger.log(`State updated for instance ${instance.idInstance} -> ${state}`);
      return instance as any;
    } catch (err) {
      this.logger.error(`Error updating state for instance ${idInstance}: ${(err as Error).message}`);
      throw err;
    }
  }

  async updateInstanceName(idInstance: string | number, name: string): Promise<Instance & { user: User }> {
    try {
      const instance = await this.instance.update({
        where: { idInstance: parseId(idInstance) },
        data: { name },
        include: { user: true },
      });
      this.logger.log(`Name updated for instance ${instance.idInstance}`);
      return instance as any;
    } catch (err) {
      this.logger.error(`Error updating name for instance ${idInstance}: ${(err as Error).message}`);
      throw err;
    }
  }

}

