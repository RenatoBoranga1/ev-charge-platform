import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

import { AdminAuthService } from '../src/admin/access/admin-auth.service';

describe('AdminAuthService', () => {
  const login = jest.fn<Promise<unknown>, [unknown]>();
  const refresh = jest.fn<Promise<unknown>, [string]>();
  const revokeAllRefreshTokens =
    jest.fn<Promise<void>, [string]>();
  const revokeRefreshToken = jest.fn<Promise<void>, [string]>();
  const decode = jest.fn<unknown, [string]>();
  const findFirst = jest.fn<Promise<unknown>, [unknown]>();
  const service = new AdminAuthService(
    {
      login,
      refresh,
      revokeAllRefreshTokens,
      revokeRefreshToken,
    } as never,
    { decode } as unknown as JwtService,
    { operatorMembership: { findFirst } } as never,
  );
  const claims = {
    email: 'admin@solis.local',
    role: 'ADMIN',
    sub: 'admin-1',
    tenantId: 'tenant-1',
  };

  beforeEach(() => {
    login.mockReset();
    refresh.mockReset();
    revokeAllRefreshTokens.mockReset();
    revokeRefreshToken.mockReset();
    decode.mockReset();
    findFirst.mockReset();
  });

  it('returns only the short access session and derived permissions', async () => {
    login.mockResolvedValue({
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
      user: {},
    });
    decode.mockReturnValue(claims);
    findFirst.mockResolvedValue({
      id: 'membership-1',
      roleAssignments: [{ role: 'FINANCE_ANALYST' }],
      tenant: { name: 'Solis Plataformas' },
      tenantId: 'tenant-1',
      user: { id: 'admin-1' },
      displayName: 'Financeiro Solis',
    });

    await expect(
      service.login({ email: 'admin@solis.local', password: 'password' }),
    ).resolves.toEqual({
      refreshToken: 'refresh',
      session: {
        accessToken: 'access',
        expiresInSeconds: 900,
        membership: {
          id: 'membership-1',
          name: 'Financeiro Solis',
          permissions: expect.arrayContaining([
            'payments.read',
            'payments.refund',
            'payments.reconcile',
          ]) as unknown,
          roles: ['FINANCE_ANALYST'],
          tenantId: 'tenant-1',
          tenantName: 'Solis Plataformas',
        },
      },
    });
  });

  it('revokes the token family when membership is inactive', async () => {
    login.mockResolvedValue({
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
      user: {},
    });
    decode.mockReturnValue(claims);
    findFirst.mockResolvedValue(null);

    await expect(
      service.login({ email: 'admin@solis.local', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('admin-1');
  });

  it('revokes the refresh token on logout', async () => {
    revokeRefreshToken.mockResolvedValue(undefined);
    await service.logout('refresh');
    expect(revokeRefreshToken).toHaveBeenCalledWith('refresh');
  });
});
