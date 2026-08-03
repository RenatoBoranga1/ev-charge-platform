import { Prisma } from '@solis/database';

import { AdminOperationsService } from '../src/admin/admin-operations.service';

describe('AdminOperationsService JSON serialization', () => {
  it('serializes BigInt, Decimal and Date values in cursor pages', async () => {
    const createdAt = new Date('2026-08-03T12:00:00.000Z');
    const findMany = jest.fn().mockResolvedValue([
      {
        createdAt,
        id: 'session-1',
        meterStartWh: 100n,
        totalAmount: new Prisma.Decimal('12.50'),
      },
    ]);
    const service = new AdminOperationsService(
      { chargingSession: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listSessions('tenant-1', { limit: 5 }),
    ).resolves.toEqual({
      data: [
        {
          createdAt: createdAt.toISOString(),
          id: 'session-1',
          meterStartWh: '100',
          totalAmount: '12.5',
        },
      ],
      nextCursor: null,
    });
  });
});