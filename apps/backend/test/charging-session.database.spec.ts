import {
  ChargingSessionStatus,
  Prisma,
  PrismaClient,
} from '@solis/database';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('ChargingSession database invariants', () => {
  const prisma = new PrismaClient();
  const ids = {
    chargePoint: 'd744cb1e-9799-49f2-807c-f7e583cb30dc',
    connector: 'd7d92f80-36a3-47ec-bf60-b931453bdb39',
    evse: '13467910-0537-4b8a-a2de-e359df8ba7dc',
    station: 'ef5a80bb-2090-45cb-83cd-bc04fc5e9a01',
    tariff: '70707070-7070-4070-8070-707070707070',
    user: 'b42d2c13-bf73-44c8-8c51-0c2369b8fe0b',
    vehicle: 'f2a7441f-e197-44df-8e90-aa21d643fa37',
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.chargingSession.deleteMany({
      where: { idempotencyKey: { startsWith: 'integration-' } },
    });
  });

  afterAll(async () => {
    await prisma.chargingSession.deleteMany({
      where: { idempotencyKey: { startsWith: 'integration-' } },
    });
    await prisma.$disconnect();
  });

  const data = (key: string) => ({
    chargePointId: ids.chargePoint,
    connectorId: ids.connector,
    evseId: ids.evse,
    idempotencyKey: key,
    stationId: ids.station,
    status: ChargingSessionStatus.PENDING,
    tariffId: ids.tariff,
    tariffSnapshot: {
      activationFee: 1,
      currency: 'BRL',
      initialBatteryPercent: 30,
      parkingFeeHour: 0,
      pricePerKwh: 2,
    } as Prisma.InputJsonValue,
    userId: ids.user,
    vehicleId: ids.vehicle,
  });

  it('prevents concurrent active sessions on one connector', async () => {
    await prisma.chargingSession.create({
      data: data('integration-concurrency-a'),
    });
    await expect(
      prisma.chargingSession.create({
        data: data('integration-concurrency-b'),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows only one optimistic update for a version', async () => {
    const session = await prisma.chargingSession.create({
      data: data('integration-version'),
    });
    const attempts = await Promise.all([
      prisma.chargingSession.updateMany({
        data: { status: ChargingSessionStatus.AUTHORIZED, version: { increment: 1 } },
        where: { id: session.id, version: session.version },
      }),
      prisma.chargingSession.updateMany({
        data: { status: ChargingSessionStatus.CANCELLED, version: { increment: 1 } },
        where: { id: session.id, version: session.version },
      }),
    ]);
    expect(attempts.map((attempt) => attempt.count).sort()).toEqual([0, 1]);
  });
});
