import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { StorageProvider, Settings } from "../evolutionapi";
import {
  InstanceState,
  User,
  Instance,
  UserCreateData,
  UserUpdateData,
} from "../types";

function parseBigInt(id: number | string | bigint): bigint {
  return typeof id === "bigint" ? id : BigInt(id);
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements
    OnModuleInit,
    StorageProvider<User, Instance, UserCreateData, UserUpdateData>
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
        'Invalid DATABASE_URL. Must start with "postgresql://" or "postgres://"'
      );
    }

    super();
  }
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
