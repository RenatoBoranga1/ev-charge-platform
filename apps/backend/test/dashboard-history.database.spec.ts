import { randomUUID } from 'node:crypto';
import {
  ChargingSessionStatus,
  UserRole,
  VehicleStatus,
  VehicleType,
} from '@solis/database';

import type { AuthUser } from '../src/auth/auth-user';
import { ChargingHistoryRepository } from '../src/charging-history/charging-history.repository';
import { ChargingHistoryService } from '../src/charging-history/charging-history.service';
import {
  ChargingHistorySort,
  type ChargingHistoryQueryDto,
} from '../src/charging-history/dto/charging-history-query.dto';
import { HistoryCursorCodec } from '../src/charging-history/history-cursor';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { PrismaService } from '../src/database/prisma.service';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Dashboard and charging history database integration', () => {
  const prisma = new PrismaService();
  const ids = {
    chargePoint: 'd744cb1e-9799-49f2-807c-f7e583cb30dc',
    connector: 'd7d92f80-36a3-47ec-bf60-b931453bdb39',
    evse: '13467910-0537-4b8a-a2de-e359df8ba7dc',
    station: 'ef5a80bb-2090-45cb-83cd-bc04fc5e9a01',
    tariff: '70707070-7070-4070-8070-707070707070',
    tenant: '20202020-2020-4020-8020-202020202020',
    user: randomUUID(),
    vehicle: randomUUID(),
  };
  const otherUserId = randomUUID();
  const otherVehicleId = randomUUID();
  const authUser: AuthUser = {
    email: 'marina.souza@example.com',
    role: UserRole.DRIVER,
    sub: ids.user,
    tenantId: ids.tenant,
  };
  const repository = new ChargingHistoryRepository(
    prisma,
    new HistoryCursorCodec(),
  );
  const history = new ChargingHistoryService(repository, prisma);
  const dashboard = new DashboardService(prisma);
  const createdIds: string[] = [];
  const now = new Date();
  const from = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const query = (
    overrides: Partial<ChargingHistoryQueryDto> = {},
  ): ChargingHistoryQueryDto => ({
    from: from.toISOString(),
    limit: 20,
    sort: ChargingHistorySort.RECENT,
    timezone: 'America/Sao_Paulo',
    to: now.toISOString(),
    ...overrides,
  });

  async function createSession(input: {
    ageHours: number;
    energyKwh: number;
    status: ChargingSessionStatus;
    totalAmount: number;
    userId?: string;
    vehicleId?: string;
  }) {
    const startedAt = new Date(now.getTime() - input.ageHours * 60 * 60 * 1000);
    const endedAt = new Date(startedAt.getTime() + 45 * 60 * 1000);
    const session = await prisma.chargingSession.create({
      data: {
        chargePointId: ids.chargePoint,
        completedAt:
          input.status === ChargingSessionStatus.COMPLETED ? endedAt : null,
        connectorId: ids.connector,
        energyKwh: input.energyKwh,
        evseId: ids.evse,
        failureReason:
          input.status === ChargingSessionStatus.FAILED
            ? 'Falha controlada'
            : null,
        idempotencyKey: `phase4-${randomUUID()}`,
        meterStartWh: 1000,
        meterStopWh: BigInt(1000 + input.energyKwh * 1000),
        startedAt,
        stationId: ids.station,
        status: input.status,
        stoppedAt: endedAt,
        tariffId: ids.tariff,
        tariffSnapshot: {
          activationFee: 0,
          currency: 'BRL',
          parkingFeeHour: 0,
          pricePerKwh: 2,
        },
        totalAmount: input.totalAmount,
        userId: input.userId ?? ids.user,
        vehicleId: input.vehicleId ?? ids.vehicle,
      },
    });
    createdIds.push(session.id);
    return session;
  }

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.create({
      data: {
        email: `phase4-driver-${ids.user}@solis.local`,
        firstName: 'Phase',
        id: ids.user,
        name: 'Phase Four',
        passwordHash: 'integration-only',
        role: UserRole.DRIVER,
        tenantId: ids.tenant,
      },
    });
    await prisma.vehicle.create({
      data: {
        batteryCapacityKwh: 60,
        brand: 'Solis Test',
        id: ids.vehicle,
        isDefault: true,
        model: 'Dashboard',
        nickname: 'Primary test vehicle',
        status: VehicleStatus.ACTIVE,
        supportedPlugTypes: [],
        userId: ids.user,
        vehicleType: VehicleType.BEV,
      },
    });
    await prisma.user.create({
      data: {
        email: `phase4-other-${otherUserId}@solis.local`,
        id: otherUserId,
        name: 'Other Driver',
        passwordHash: 'integration-only',
        role: UserRole.DRIVER,
        tenantId: ids.tenant,
      },
    });
    await prisma.vehicle.create({
      data: {
        batteryCapacityKwh: 40,
        brand: 'Solis Test',
        id: otherVehicleId,
        isDefault: true,
        model: 'Isolation',
        nickname: 'Other vehicle',
        status: VehicleStatus.ACTIVE,
        supportedPlugTypes: [],
        userId: otherUserId,
        vehicleType: VehicleType.BEV,
      },
    });
  });

  beforeEach(async () => {
    await prisma.meterValue.deleteMany({
      where: { chargingSessionId: { in: createdIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: createdIds } },
    });
    await prisma.chargingSession.deleteMany({
      where: { id: { in: createdIds } },
    });
    createdIds.length = 0;
  });

  afterAll(async () => {
    await prisma.meterValue.deleteMany({
      where: { chargingSessionId: { in: createdIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: createdIds } },
    });
    await prisma.chargingSession.deleteMany({
      where: {
        OR: [
          { id: { in: createdIds } },
          { idempotencyKey: { startsWith: 'phase4-' } },
        ],
      },
    });
    await prisma.vehicle.deleteMany({
      where: { id: { in: [ids.vehicle, otherVehicleId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.user, otherUserId] } },
    });
    await prisma.$disconnect();
  });

  it('aggregates the dashboard without inventing savings or CO2', async () => {
    await createSession({
      ageHours: 4,
      energyKwh: 5,
      status: ChargingSessionStatus.COMPLETED,
      totalAmount: 10,
    });
    await createSession({
      ageHours: 28,
      energyKwh: 10,
      status: ChargingSessionStatus.COMPLETED,
      totalAmount: 20,
    });
    await createSession({
      ageHours: 52,
      energyKwh: 1,
      status: ChargingSessionStatus.FAILED,
      totalAmount: 0,
    });

    const result = await dashboard.getDashboard(authUser, {
      from: from.toISOString(),
      timezone: 'America/Sao_Paulo',
      to: now.toISOString(),
    });
    expect(result.summary).toMatchObject({
      avoidedCo2Kg: null,
      completedSessions: 2,
      currency: 'BRL',
      estimatedSavings: null,
      failedSessions: 1,
      totalCost: '30.00',
      totalEnergyKwh: 16,
      totalSessions: 3,
    });
    expect(result.lastSession).toMatchObject({
      cost: { amount: '10.00', currency: 'BRL' },
      energyKwh: 5,
    });
    expect(result.mostUsedStation).toMatchObject({
      id: ids.station,
      sessionCount: 3,
    });
    expect(result.primaryVehicle?.id).toBe(ids.vehicle);
  });

  it('returns an empty dashboard and rejects another user vehicle', async () => {
    const empty = await dashboard.getDashboard(
      { ...authUser, sub: otherUserId },
      {
        from: from.toISOString(),
        timezone: 'UTC',
        to: now.toISOString(),
      },
    );
    expect(empty.summary).toMatchObject({
      totalCost: null,
      totalEnergyKwh: 0,
      totalSessions: 0,
    });
    await expect(
      dashboard.getDashboard(authUser, {
        from: from.toISOString(),
        timezone: 'UTC',
        to: now.toISOString(),
        vehicleId: otherVehicleId,
      }),
    ).rejects.toThrow('Veiculo nao encontrado.');
  });

  it('paginates with a signed cursor and applies backend sorting and filters', async () => {
    await createSession({
      ageHours: 4,
      energyKwh: 5,
      status: ChargingSessionStatus.COMPLETED,
      totalAmount: 10,
    });
    await createSession({
      ageHours: 28,
      energyKwh: 10,
      status: ChargingSessionStatus.COMPLETED,
      totalAmount: 20,
    });
    await createSession({
      ageHours: 52,
      energyKwh: 1,
      status: ChargingSessionStatus.FAILED,
      totalAmount: 0,
    });

    const first = await history.list(authUser, query({ limit: 2 }));
    expect(first.items).toHaveLength(2);
    expect(first.pageInfo.hasNextPage).toBe(true);
    const second = await history.list(
      authUser,
      query({ cursor: first.pageInfo.endCursor!, limit: 2 }),
    );
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((item) => item.id))).toHaveProperty(
      'size',
      3,
    );

    const energy = await history.list(
      authUser,
      query({ sort: ChargingHistorySort.ENERGY_DESC }),
    );
    expect(energy.items.map((item) => item.energyKwh)).toEqual([10, 5, 1]);
    const failed = await history.list(
      authUser,
      query({ failuresOnly: 'true' }),
    );
    expect(failed.items).toHaveLength(1);
    expect(failed.items[0]).toMatchObject({
      cost: null,
      status: 'failed',
    });
    await expect(
      history.list(authUser, query({ cursor: 'invalid.cursor' })),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_CURSOR' },
    });
  });

  it('returns safe details, timeline and downsampled metrics', async () => {
    const session = await createSession({
      ageHours: 4,
      energyKwh: 5,
      status: ChargingSessionStatus.COMPLETED,
      totalAmount: 10,
    });
    const sampledAt = new Date(session.startedAt!);
    await prisma.meterValue.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        chargingSessionId: session.id,
        energyKwh: index / 5,
        meterWh: BigInt(1000 + index * 200),
        powerKw: 20 + index,
        sampledAt: new Date(sampledAt.getTime() + index * 60_000),
      })),
    });
    await prisma.auditLog.createMany({
      data: [
        {
          action: 'CHARGING_SESSION_CREATED',
          after: { status: ChargingSessionStatus.PENDING },
          entityId: session.id,
          entityType: 'ChargingSession',
          tenantId: ids.tenant,
          userId: ids.user,
        },
        {
          action: 'CHARGING_SESSION_STATE_CHANGED',
          after: { status: ChargingSessionStatus.COMPLETED },
          entityId: session.id,
          entityType: 'ChargingSession',
          tenantId: ids.tenant,
          userId: ids.user,
        },
      ],
    });

    const details = await history.getDetails(session.id, authUser);
    expect(details).toMatchObject({
      cost: { amount: '10.00', currency: 'BRL' },
      meter: { startWh: '1000', stopWh: '6000' },
      power: { maximumPowerKw: 44 },
      station: { id: ids.station },
    });
    expect(details).not.toHaveProperty('tariffSnapshot');

    const timeline = await history.getTimeline(session.id, authUser);
    expect(timeline.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['created', 'completed', 'first_measurement']),
    );
    const metrics = await history.getMetrics(session.id, authUser, 10);
    expect(metrics.points.length).toBeLessThanOrEqual(10);
    expect(metrics.summary).toMatchObject({
      maximumPowerKw: 44,
      originalPointCount: 25,
    });
  });

  it('isolates sessions by user and tenant', async () => {
    const otherSession = await createSession({
      ageHours: 4,
      energyKwh: 3,
      status: ChargingSessionStatus.COMPLETED,
      totalAmount: 6,
      userId: otherUserId,
      vehicleId: otherVehicleId,
    });
    await expect(history.getDetails(otherSession.id, authUser)).rejects.toThrow(
      'Sessao nao encontrada.',
    );
    await expect(
      history.getDetails(otherSession.id, {
        ...authUser,
        sub: otherUserId,
        tenantId: randomUUID(),
      }),
    ).rejects.toThrow('Sessao nao encontrada.');
  });
});
