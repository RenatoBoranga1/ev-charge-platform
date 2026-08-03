import { ConflictException, ForbiddenException } from '@nestjs/common';
import { adminPermissions } from '@solis/admin-contracts';

import { AdminOperationsService } from '../src/admin/admin-operations.service';

describe('AdminOperationsService operator safety', () => {
  const admin = {
    email: 'admin@solis.local',
    role: 'ADMIN',
    sub: 'admin-user',
    tenantId: 'tenant-1',
  };
  const context = { correlationId: 'correlation-1' };
  const tenantAdmin = {
    membershipId: 'admin-membership',
    permissions: [...adminPermissions],
    roles: ['TENANT_ADMIN'],
  } as never;
  const membership = {
    id: 'membership-1',
    roleAssignments: [{ role: 'TENANT_ADMIN' }],
    status: 'ACTIVE',
    tenantId: 'tenant-1',
    userId: 'operator-user',
  };
  const findFirst = jest.fn();
  const count = jest.fn();
  const deleteMany = jest.fn();
  const createMany = jest.fn();
  const update = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const tx = {
    operatorMembership: { findFirst, findUniqueOrThrow, update },
    operatorRoleAssignment: { count, createMany, deleteMany },
  };
  const transaction = jest.fn(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  );
  const revokeAllRefreshTokens = jest.fn();
  const record = jest.fn();
  const service = new AdminOperationsService(
    { $transaction: transaction } as never,
    {} as never,
    {} as never,
    {} as never,
    { revokeAllRefreshTokens } as never,
    { record } as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue(membership);
    count.mockResolvedValue(0);
  });

  it('prevents removing the last active tenant administrator role', async () => {
    await expect(
      service.assignRoles(
        admin,
        tenantAdmin,
        membership.id,
        { roles: ['OPERATIONS_MANAGER'] },
        context,
      ),
    ).rejects.toThrow(ConflictException);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('blocks assigning permissions higher than the current operator', async () => {
    const limitedActor = {
      membershipId: 'limited-membership',
      permissions: ['users.assign_roles'],
      roles: ['SUPPORT_AGENT'],
    } as never;

    await expect(
      service.assignRoles(
        admin,
        limitedActor,
        membership.id,
        { roles: ['TENANT_ADMIN'] },
        context,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('prevents disabling the last active tenant administrator', async () => {
    await expect(
      service.disableOperator(
        admin,
        membership.id,
        { reason: 'Desativação administrativa revisada' },
        context,
      ),
    ).rejects.toThrow(ConflictException);

    expect(update).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('allows role reassignment when another active tenant administrator exists', async () => {
    count.mockResolvedValue(1);
    const updated = {
      ...membership,
      roleAssignments: [{ role: 'OPERATIONS_MANAGER' }],
    };
    findUniqueOrThrow.mockResolvedValue(updated);
    deleteMany.mockResolvedValue({ count: 1 });
    createMany.mockResolvedValue({ count: 1 });
    update.mockResolvedValue(updated);
    record.mockResolvedValue(undefined);

    await expect(
      service.assignRoles(
        admin,
        tenantAdmin,
        membership.id,
        { roles: ['OPERATIONS_MANAGER'] },
        context,
      ),
    ).resolves.toEqual(updated);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OPERATOR_ROLES_ASSIGNED',
        tenantId: 'tenant-1',
      }),
    );
  });
});
