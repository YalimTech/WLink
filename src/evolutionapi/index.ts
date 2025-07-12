export interface Settings {
  wid?: string;
  [key: string]: any;
}

export interface StorageProvider<User, Instance, UserCreateData, UserUpdateData> {
  createUser(data: UserCreateData): Promise<User>;
  findUser(identifier: string): Promise<User | null>;
  updateUser(identifier: string, data: UserUpdateData): Promise<User>;
  getUserWithTokens(userId: string): Promise<User | null>;
  updateUserTokens(userId: string, accessToken: string, refreshToken: string, tokenExpiresAt: Date): Promise<User>;
  createInstance(data: any): Promise<Instance>;
  getInstance(idInstance: number | string | bigint): Promise<Instance | null | (Instance & { user: User })>;
  getInstancesByUserId(userId: string): Promise<Instance[]>;
  removeInstance(idInstance: number | string | bigint): Promise<Instance>;
  updateInstanceSettings(idInstance: number | string | bigint, settings: Settings): Promise<Instance>;
  updateInstanceState(idInstance: number | string | bigint, state: any): Promise<Instance>;
  updateInstanceName(idInstance: number | string | bigint, name: string): Promise<Instance & { user: User }>;
}

import { Logger } from '@nestjs/common';

export class EvolutionApiLogger extends Logger {
  static getInstance(context: string): EvolutionApiLogger {
    return new EvolutionApiLogger(context);
  }
}

import { CanActivate, ExecutionContext } from '@nestjs/common';

export abstract class BaseEvolutionApiAuthGuard implements CanActivate {
  constructor(protected readonly storageService: StorageProvider<any, any, any, any>) {}
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    return true;
  }
  protected async validateRequest(_request: any): Promise<boolean> {
    return true;
  }
}
