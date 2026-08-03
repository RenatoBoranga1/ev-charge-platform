import { Prisma } from '@solis/database';

import { AdminAuditService } from '../src/admin/audit/admin-audit.service';

describe('AdminAuditService', () => {
  const create = jest.fn<Promise<unknown>, [unknown]>();
  const service = new AdminAuditService({
    auditLog: { create },
  } as never);

  beforeEach(() => create.mockReset());

  it('redacts secrets recursively and serializes bigint values', () => {
    expect(
      service.sanitize({
        amountMinor: 500n,
        createdAt: new Date('2026-08-03T12:00:00.000Z'),
        latitude: new Prisma.Decimal('-23.55'),
        nested: [{ authorization: 'Bearer secret', label: 'safe' }],
        password: 'not-for-logs',
        providerToken: 'also-secret',
      }),
    ).toEqual({
      amountMinor: '500',
      createdAt: '2026-08-03T12:00:00.000Z',
      latitude: '-23.55',
      nested: [{ authorization: '[REDACTED]', label: 'safe' }],
      password: '[REDACTED]',
      providerToken: '[REDACTED]',
    });
  });

  it('persists an enriched tenant-scoped audit event', async () => {
    create.mockResolvedValue({ id: 'audit-1' });
    await service.record({
      action: 'TARIFF_PUBLISHED',
      after: { token: 'secret', version: 2 },
      correlationId: 'correlation-1',
      entityId: 'tariff-1',
      entityType: 'Tariff',
      ipAddress: '127.0.0.1',
      justification: 'Publicação operacional revisada',
      tenantId: 'tenant-1',
      userAgent: 'test-agent',
      userId: 'user-1',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        action: 'TARIFF_PUBLISHED',
        actorType: 'OPERATOR',
        after: { token: '[REDACTED]', version: 2 },
        before: undefined,
        correlationId: 'correlation-1',
        entityId: 'tariff-1',
        entityType: 'Tariff',
        ipAddress: '127.0.0.1',
        justification: 'Publicação operacional revisada',
        outcome: 'SUCCESS',
        result: undefined,
        tenantId: 'tenant-1',
        userAgent: 'test-agent',
        userId: 'user-1',
      },
    });
  });
});
