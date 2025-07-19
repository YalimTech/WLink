import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { EvolutionApiWebhookGuard } from './evolution-api-webhook.guard';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

describe('EvolutionApiWebhookGuard', () => {
  let guard: EvolutionApiWebhookGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('token-secreto-de-prueba') } as any;
    guard = new EvolutionApiWebhookGuard(configService);
  });

  const createContext = (request: Partial<Request>): ExecutionContext => ({
    switchToHttp: () => ({ getRequest: () => request as Request }),
  } as any);

  it('debería permitir el acceso si el header "x-evolution-token" es válido', async () => {
    const ctx = createContext({ headers: { 'x-evolution-token': 'token-secreto-de-prueba' } as any });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('debería lanzar UnauthorizedException si el token falta en el header', async () => {
    const ctx = createContext({ headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debería lanzar UnauthorizedException si el token en el header es incorrecto', async () => {
    const ctx = createContext({ headers: { 'x-evolution-token': 'token-incorrecto' } as any });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
