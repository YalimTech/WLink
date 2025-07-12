import { Injectable, OnModuleInit, NotFoundException, Logger } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
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
  implements OnModuleInit,
    StorageProvider<
      User,
      Instance,
      UserCreateData,
      UserUpdateData
    > {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
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
        this.logger.warn(
          `Database connection attempt ${attempt} failed. Retrying in ${delayMs}ms...`,
        );
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }

  async createUser(data: UserCreateData): Promise<User> {
    if (!data.id) {
      throw new Error("Missing user ID for createUser()");
    }

    return this.user.upsert({
      where: { id: data.id },
      update: data as any,
      create: data as any,
    });
  }

  async findUser(identifier: string): Promise<User | null> {
    return this.user.findUnique({
      where: { id: identifier },
    });
  }

  async updateUser(
    identifier: string,
    data: UserUpdateData,
  ): Promise<User> {
    return this.user.update({
      where: { id: identifier },
      data: data as any,
    });
  }

  async getUserWithTokens(userId: string): Promise<User | null> {
    return this.user.findUnique({
      where: { id: userId },
    });
  }

  async updateUserTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date,
  ): Promise<User> {
    return this.user.update({
      where: { id: userId },
      data: { accessToken, refreshToken, tokenExpiresAt } as any,
    });
  }


  async createInstance(instanceData: any): Promise<Instance> {
    const ghlLocationId = instanceData.user?.connect?.id;
    const stateInstance = instanceData.stateInstance;
    const idInstance = parseBigInt(instanceData.idInstance);

    if (!ghlLocationId) {
      throw new Error("userId (GHL Location ID as string) is required on the instance data to create an Instance.");
    }

    const userExists = await this.user.findUnique({
      where: { id: ghlLocationId },
    });

    if (!userExists) {
      throw new NotFoundException(`User (GHL Location) with ID ${ghlLocationId} not found. Cannot create instance.`);
    }

    const existingInstance = await this.instance.findUnique({
      where: { idInstance },
    });

    if (existingInstance) {
      throw new Error(`Instance with ID ${idInstance} already exists.`);
    }

    return (await this.instance.create({
      data: {
        idInstance,
        apiTokenInstance: instanceData.apiTokenInstance,
        stateInstance: stateInstance || InstanceState.notAuthorized,
        settings: instanceData.settings || {},
        name: instanceData.name,
        phoneNumber: instanceData.phoneNumber,
        user: {
          connect: { id: ghlLocationId },
        },
      } as any,
    })) as unknown as Instance;
  }

  async getInstance(idInstance: number | string | bigint): Promise<(Instance & { user: User }) | null> {
    return (await this.instance.findUnique({
      where: { idInstance: parseBigInt(idInstance) },
      include: { user: true },
    })) as unknown as (Instance & { user: User }) | null;
  }

  async getInstancesByUserId(userId: string): Promise<Instance[]> {
    return (await this.instance.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })) as unknown as Instance[];
  }

  async removeInstance(idInstance: number | string | bigint): Promise<Instance> {
    return (await this.instance.delete({
      where: { idInstance: parseBigInt(idInstance) },
    })) as unknown as Instance;
  }

  async updateInstanceSettings(idInstance: number | string | bigint, settings: Settings): Promise<Instance> {
    return (await this.instance.update({
      where: { idInstance: parseBigInt(idInstance) },
      data: { settings: settings || {} },
    })) as unknown as Instance;
  }

  async updateInstanceState(idInstance: number | string | bigint, state: InstanceState): Promise<Instance> {
    return (await this.instance.update({
      where: { idInstance: parseBigInt(idInstance) },
      data: { stateInstance: state },
    })) as unknown as Instance;
  }

  async updateInstanceName(idInstance: number | string | bigint, name: string): Promise<Instance & { user: User }> {
    return (await this.instance.update({
      where: { idInstance: parseBigInt(idInstance) },
      data: { name },
      include: { user: true },
    })) as unknown as Instance & { user: User };
  }
}

