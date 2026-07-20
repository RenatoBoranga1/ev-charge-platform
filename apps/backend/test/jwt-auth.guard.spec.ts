import {
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: { header: jest.Mock; user?: unknown };
} {
  const request = {
    header: jest.fn().mockReturnValue(authorization),
  };
  const context = {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  const verifyAsync = jest.fn();
  const getAllAndOverride = jest.fn();
  const guard = new JwtAuthGuard(
    { verifyAsync } as unknown as JwtService,
    { getAllAndOverride } as unknown as Reflector,
  );

  beforeEach(() => {
    verifyAsync.mockReset();
    getAllAndOverride.mockReset();
  });

  it('allows routes explicitly marked public', async () => {
    getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(createContext().context)).resolves.toBe(true);
  });

  it('rejects missing bearer tokens', async () => {
    getAllAndOverride.mockReturnValue(false);
    await expect(guard.canActivate(createContext().context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches valid JWT claims to the request', async () => {
    getAllAndOverride.mockReturnValue(false);
    const claims = { sub: 'user', tenantId: 'tenant' };
    verifyAsync.mockResolvedValue(claims);
    const { context, request } = createContext('Bearer token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(claims);
  });

  it('rejects tokens that fail verification', async () => {
    getAllAndOverride.mockReturnValue(false);
    verifyAsync.mockRejectedValue(new Error('invalid'));
    await expect(
      guard.canActivate(createContext('Bearer invalid').context),
    ).rejects.toThrow(UnauthorizedException);
  });
});
