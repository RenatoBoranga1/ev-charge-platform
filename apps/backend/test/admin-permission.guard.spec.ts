import {
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import type { AdminRequest } from '../src/admin/access/admin-access';
import { AdminPermissionGuard } from '../src/admin/access/admin-permission.guard';

function contextFor(request: Partial<AdminRequest>): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminPermissionGuard', () => {
  const getAllAndOverride =
    jest.fn<string[] | undefined, [string, unknown[]]>();
  const findFirst =
    jest.fn<Promise<unknown>, [unknown]>();
  const guard = new AdminPermissionGuard(
    { getAllAndOverride } as unknown as Reflector,
    { operatorMembership: { findFirst } } as never,
  );
  const request = {
    header: jest.fn(),
    user: {
      email: 'operator@solis.local',
      role: 'ADMIN',
      sub: 'user-1',
      tenantId: 'tenant-1',
    },
  } as Partial<AdminRequest>;

  beforeEach(() => {
    getAllAndOverride.mockReset();
    findFirst.mockReset();
    delete request.admin;
  });

  it('allows non-admin routes without querying membership', async () => {
    getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects protected routes when authentication has not populated the request', async () => {
    getAllAndOverride.mockReturnValue(['stations.read']);
    const anonymousRequest = { header: jest.fn() } as Partial<AdminRequest>;

    await expect(
      guard.canActivate(contextFor(anonymousRequest)),
    ).rejects.toThrow('Autenticação administrativa obrigatória.');
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('derives permissions from active tenant-scoped roles', async () => {
    getAllAndOverride.mockReturnValue(['stations.update']);
    findFirst.mockResolvedValue({
      id: 'membership-1',
      roleAssignments: [{ role: 'STATION_OPERATOR' }],
    });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.admin).toEqual({
      membershipId: 'membership-1',
      permissions: expect.arrayContaining([
        'stations.update',
        'sessions.remote_stop',
      ]) as unknown,
      roles: ['STATION_OPERATOR'],
    });
    expect(findFirst).toHaveBeenCalledWith({
      include: { roleAssignments: true },
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        tenantId: 'tenant-1',
        userId: 'user-1',
      },
    });
  });

  it('denies a missing or inactive membership', async () => {
    getAllAndOverride.mockReturnValue([]);
    findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(contextFor(request)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies permissions absent from the assigned role', async () => {
    getAllAndOverride.mockReturnValue(['payments.refund']);
    findFirst.mockResolvedValue({
      id: 'membership-1',
      roleAssignments: [{ role: 'VIEWER' }],
    });
    await expect(
      guard.canActivate(contextFor(request)),
    ).rejects.toThrow(ForbiddenException);
  });
});
