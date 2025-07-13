import { Test } from '@nestjs/testing';
import { AuthController } from '../src/auth.controller';
import { AuthService } from '../src/auth.service';
import { HttpStatus, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let validateMock: jest.Mock;

  beforeEach(async () => {
    validateMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { validateInstance: validateMock } }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  function createRes() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
  }

  it('uses body parameters when provided', async () => {
    validateMock.mockResolvedValue('ok');
    const res = createRes();
    await controller.externalAuth(
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      'bodyId',
      undefined as any,
      'bodyToken',
      res,
    );
    expect(validateMock).toHaveBeenCalledWith('bodyId', 'bodyToken');
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      instanceId: 'bodyId',
      instanceToken: 'bodyToken',
      status: 'ok',
    });
  });

  it('uses query parameters when body missing', async () => {
    validateMock.mockResolvedValue('ok');
    const res = createRes();
    await controller.externalAuth('idp', undefined as any, 'tokp', undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, res);
    expect(validateMock).toHaveBeenCalledWith('idp', 'tokp');
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('returns 400 when parameters missing', async () => {
    const res = createRes();
    await controller.externalAuth(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, res);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('returns 401 when validation fails', async () => {
    validateMock.mockRejectedValue(new UnauthorizedException('bad'));
    const res = createRes();
    await controller.externalAuth('a', undefined as any, 'b', undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, res);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
  });
});
