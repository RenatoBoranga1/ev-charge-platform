import { adminPermissions } from '@solis/admin-contracts';
import { Prisma } from '@solis/database';

import { AdminOperationsService } from '../src/admin/admin-operations.service';

describe('AdminOperationsService remote command idempotency', () => {
  const user = {
    email: 'admin@solis.local',
    role: 'ADMIN',
    sub: 'admin-user',
    tenantId: 'tenant-1',
  };
  const actor = {
    membershipId: 'membership-1',
    permissions: [...adminPermissions],
    roles: ['TENANT_ADMIN'],
  } as never;
  const input = {
    chargingSessionId: 'session-1',
    reason: 'Validação operacional confirmada',
    type: 'REMOTE_START',
  } as const;
  const session = {
    chargePointId: 'charge-point-1',
    connectorId: 'connector-1',
    deletedAt: null,
    id: 'session-1',
    stationId: 'station-1',
    user: {
      email: 'driver@solis.local',
      id: 'driver-1',
      name: 'Driver',
      role: 'DRIVER',
    },
  };
  const chargingSessionFindFirst = jest.fn();
  const remoteFindUnique = jest.fn();
  const remoteCreate = jest.fn();
  const remoteUpdate = jest.fn();
  const tx = {
    remoteCommand: { create: remoteCreate, update: remoteUpdate },
  };
  const transaction = jest.fn(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  );
  const chargingStart = jest.fn();
  const auditRecord = jest.fn();
  const auditSanitize = jest.fn((value: unknown) => value);
  const outboxPublish = jest.fn();
  const service = new AdminOperationsService(
    {
      $transaction: transaction,
      chargingSession: { findFirst: chargingSessionFindFirst },
      remoteCommand: { findUnique: remoteFindUnique, update: remoteUpdate },
    } as never,
    { start: chargingStart } as never,
    {} as never,
    {} as never,
    {} as never,
    { record: auditRecord, sanitize: auditSanitize } as never,
    { publish: outboxPublish },
  );

  beforeEach(() => {
    jest.clearAllMocks();
    chargingSessionFindFirst.mockResolvedValue(session);
  });

  it('returns the concurrent replay after the unique constraint wins elsewhere', async () => {
    const replay = {
      id: 'command-existing',
      requestHash:
        'f8b3daa0ccb2288732b98b0bd241c82237bac27eff4c2c2bcf985aec56d6be60',
      status: 'QUEUED',
    };
    remoteFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(replay);
    remoteCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique constraint', {
        clientVersion: 'test',
        code: 'P2002',
      }),
    );

    await expect(
      service.createCommand(
        user,
        actor,
        'same-key',
        input,
        { correlationId: 'correlation-1' },
      ),
    ).resolves.toEqual(replay);

    expect(chargingStart).not.toHaveBeenCalled();
    expect(remoteCreate).toHaveBeenCalledTimes(1);
  });

  it('atomically records the request and its outbox event before dispatch', async () => {
    const queued = {
      id: 'command-1',
      requestHash:
        'f8b3daa0ccb2288732b98b0bd241c82237bac27eff4c2c2bcf985aec56d6be60',
      status: 'QUEUED',
    };
    remoteFindUnique.mockResolvedValue(null);
    remoteCreate.mockResolvedValue(queued);
    remoteUpdate
      .mockResolvedValueOnce({ ...queued, status: 'SENT' })
      .mockResolvedValueOnce({ ...queued, status: 'ACCEPTED' });
    chargingStart.mockResolvedValue({ id: 'session-1', status: 'charging' });
    auditRecord.mockResolvedValue(undefined);
    outboxPublish.mockResolvedValue(undefined);

    await expect(
      service.createCommand(
        user,
        actor,
        'same-key',
        input,
        { correlationId: 'correlation-1' },
      ),
    ).resolves.toEqual(expect.objectContaining({ status: 'ACCEPTED' }));

    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'OCPP_REMOTE_START_REQUESTED' }),
      tx,
    );
    expect(outboxPublish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'RemoteCommandQueued' }),
      tx,
    );
  });
});
