import { Test } from '@nestjs/testing';
import { GhlOauthController } from '../src/oauth/oauth.controller';
import { AuthService } from '../src/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { GhlService } from '../src/ghl/ghl.service';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('GhlOauthController', () => {
  let controller: GhlOauthController;
  let authService: { validateInstance: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let ghlService: { createEvolutionApiInstanceForUser: jest.Mock };

  beforeEach(async () => {
    authService = { validateInstance: jest.fn().mockResolvedValue(true) };
    prisma = { user: { findUnique: jest.fn() } } as any;
    ghlService = { createEvolutionApiInstanceForUser: jest.fn() } as any;

    const moduleRef = await Test.createTestingModule({
      controllers: [GhlOauthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PrismaService, useValue: prisma },
        { provide: GhlService, useValue: ghlService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = moduleRef.get(GhlOauthController);
  });

  it('accepts locationId from query parameters', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'loc' });
    const result = await controller.handleExternalAuthCredentials('id1', 'tok1', 'loc', {} as any);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'loc' } });
    expect(authService.validateInstance).toHaveBeenCalledWith('id1', 'tok1');
    expect(ghlService.createEvolutionApiInstanceForUser).toHaveBeenCalledWith('loc', 'id1', 'tok1');
    expect(result).toEqual({ message: 'Valid credentials' });
  });

  it('accepts locationId from body array', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'loc2' });
    const result = await controller.handleExternalAuthCredentials('i', 't', undefined as any, { locationId: ['loc2'] } as any);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'loc2' } });
    expect(authService.validateInstance).toHaveBeenCalledWith('i', 't');
    expect(ghlService.createEvolutionApiInstanceForUser).toHaveBeenCalledWith('loc2', 'i', 't');
    expect(result).toEqual({ message: 'Valid credentials' });
  });

  it('throws when locationId missing', async () => {
    await expect(
      controller.handleExternalAuthCredentials('i', 't', undefined as any, {} as any)
    ).rejects.toThrow(HttpException);
  });

  it('throws when locationId invalid', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      controller.handleExternalAuthCredentials('i', 't', 'bad', {} as any)
    ).rejects.toThrow(HttpException);
  });

  it('throws when credentials missing', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'loc' });
    await expect(
      controller.handleExternalAuthCredentials(undefined as any, undefined as any, 'loc', {} as any)
    ).rejects.toThrow(HttpException);
  });
});
