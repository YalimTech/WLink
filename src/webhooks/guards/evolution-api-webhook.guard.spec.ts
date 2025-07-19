import { ExecutionContext } from '@nestjs/common';
import { EvolutionApiWebhookGuard } from './evolution-api-webhook.guard';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

describe('EvolutionApiWebhookGuard', () => {
  let guard: EvolutionApiWebhookGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('secret') } as any;
    guard = new EvolutionApiWebhookGuard(configService);
  });

  const createContext = (request: Partial<Request>): ExecutionContext => ({
    switchToHttp: () => ({ getRequest: () => request as Request }),
  } as any);

  it('allows token in headers', async () => {
    const ctx = createContext({ headers: { 'x-evolution-token': 'secret' } as any });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows token in query', async () => {
    const ctx = createContext({ headers: {}, query: { token: 'secret' } as any, body: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows token in body', async () => {
    const ctx = createContext({ headers: {}, query: {}, body: { webhook_token: 'secret' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
