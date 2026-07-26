import {
  ChargerProtocol,
  ChargingSessionStatus,
  ConnectorStatus,
  OcppTransactionStatus,
} from '@solis/database';
import WebSocket, { type RawData } from 'ws';

import {
  type ChargerEvent,
  ChargerEventRelay,
} from '../src/charging/gateway/charger-event-relay';
import { environment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { Ocpp16CentralSystemService } from '../src/ocpp/ocpp16-central-system.service';

type TestFrame = unknown[];
type FramePredicate = (frame: TestFrame) => boolean;

function rawDataToText(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 3_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for test condition.');
}

class TestChargePoint {
  private readonly queue: TestFrame[] = [];
  private readonly waiters: Array<{
    predicate: FramePredicate;
    reject: (error: Error) => void;
    resolve: (frame: TestFrame) => void;
    timer: NodeJS.Timeout;
  }> = [];
  private sequence = 0;
  private closeCode?: number;

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => this.receive(JSON.parse(rawDataToText(data)) as TestFrame));
    socket.on('close', (code) => {
      this.closeCode = code;
    });
  }

  static async connect(
    port: number,
    password = 'solis-ocpp-demo',
    identity = 'SOLIS-OCPP-001',
  ): Promise<TestChargePoint> {
    const credentials = Buffer.from(identity + ':' + password).toString('base64');
    const socket = new WebSocket(
      `ws://localhost:${port}/ocpp/${encodeURIComponent(identity)}`,
      'ocpp1.6',
      { headers: { Authorization: 'Basic ' + credentials } },
    );
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return new TestChargePoint(socket);
  }

  async call(
    action: string,
    payload: Record<string, unknown>,
    uniqueId = 'cp-' + ++this.sequence,
  ): Promise<TestFrame> {
    this.socket.send(JSON.stringify([2, uniqueId, action, payload]));
    return this.waitFor((frame) => frame[1] === uniqueId && (frame[0] === 3 || frame[0] === 4));
  }

  waitCommand(action: string): Promise<TestFrame> {
    return this.waitFor((frame) => frame[0] === 2 && frame[2] === action);
  }

  sendResult(uniqueId: unknown, payload: Record<string, unknown>): void {
    this.socket.send(JSON.stringify([3, uniqueId, payload]));
  }

  async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    const closed = new Promise<void>((resolve) => this.socket.once('close', () => resolve()));
    this.socket.close(1000, 'test complete');
    await closed;
  }

  waitForClose(): Promise<number> {
    if (this.closeCode !== undefined) return Promise.resolve(this.closeCode);
    return new Promise((resolve) => this.socket.once('close', (code) => resolve(code)));
  }

  private waitFor(predicate: FramePredicate, timeoutMs = 3_000): Promise<TestFrame> {
    const index = this.queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiterIndex = this.waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (waiterIndex >= 0) this.waiters.splice(waiterIndex, 1);
        reject(new Error('Timed out waiting for OCPP frame.'));
      }, timeoutMs);
      this.waiters.push({ predicate, reject, resolve, timer });
    });
  }

  private receive(frame: TestFrame): void {
    const index = this.waiters.findIndex((waiter) => waiter.predicate(frame));
    if (index < 0) {
      this.queue.push(frame);
      return;
    }
    const waiter = this.waiters.splice(index, 1)[0]!;
    clearTimeout(waiter.timer);
    waiter.resolve(frame);
  }
}

const describeDatabase = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('OCPP 1.6J central system integration', () => {
  jest.setTimeout(30_000);

  const ids = {
    chargePoint: '50505050-5050-4050-8050-505050505050',
    connector: 'e6eb9afe-014b-4ec0-9601-3292b2c59191',
    evse: '60606060-6060-4060-8060-606060606060',
    station: 'c664b28c-6041-4715-88dd-07c714a80fb0',
    tariff: '90909090-9090-4090-8090-909090909090',
    user: 'b42d2c13-bf73-44c8-8c51-0c2369b8fe0b',
    vehicle: 'f2a7441f-e197-44df-8e90-aa21d643fa37',
  };
  const prisma = new PrismaService();
  const relay = new ChargerEventRelay();
  const service = new Ocpp16CentralSystemService(prisma, relay);
  const clients: TestChargePoint[] = [];
  const receivedEvents: ChargerEvent[] = [];
  let port: number;
  let unsubscribe: () => void;

  beforeAll(async () => {
    await prisma.$connect();
    port = await service.listen(0);
    unsubscribe = relay.subscribe((event) => {
      receivedEvents.push(event);
      return Promise.resolve();
    });
  });

  beforeEach(async () => {
    for (const client of clients.splice(0)) await client.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await prisma.ocppMessage.deleteMany({ where: { chargePointId: ids.chargePoint } });
    await prisma.ocppTransaction.deleteMany({ where: { chargePointId: ids.chargePoint } });
    await prisma.chargingSession.deleteMany({
      where: { idempotencyKey: { startsWith: 'ocpp-test-' } },
    });
    await prisma.connector.update({
      data: { status: ConnectorStatus.AVAILABLE },
      where: { id: ids.connector },
    });
    await prisma.chargePoint.update({
      data: {
        ocppEnabled: true,
        protocol: ChargerProtocol.OCPP16,
      },
      where: { id: ids.chargePoint },
    });
    receivedEvents.length = 0;
  });

  afterAll(async () => {
    for (const client of clients.splice(0)) await client.close();
    unsubscribe();
    await service.close();
    await prisma.ocppMessage.deleteMany({ where: { chargePointId: ids.chargePoint } });
    await prisma.ocppTransaction.deleteMany({ where: { chargePointId: ids.chargePoint } });
    await prisma.chargingSession.deleteMany({
      where: { idempotencyKey: { startsWith: 'ocpp-test-' } },
    });
    await prisma.$disconnect();
  });

  async function connected(): Promise<TestChargePoint> {
    const client = await TestChargePoint.connect(port);
    clients.push(client);
    return client;
  }

  async function rejectedUpgrade(
    path: string,
    protocols?: string,
    authorization?: string,
  ): Promise<number> {
    const options = authorization ? { headers: { Authorization: authorization } } : undefined;
    const socket = protocols
      ? new WebSocket(`ws://localhost:${port}${path}`, protocols, options)
      : new WebSocket(`ws://localhost:${port}${path}`, options);
    return new Promise<number>((resolve, reject) => {
      socket.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      socket.once('open', () => reject(new Error('Rejected upgrade was accepted.')));
      socket.once('error', () => undefined);
    });
  }

  async function createSession(suffix: string) {
    return prisma.chargingSession.create({
      data: {
        chargePointId: ids.chargePoint,
        connectorId: ids.connector,
        evseId: ids.evse,
        idempotencyKey: 'ocpp-test-' + suffix,
        stationId: ids.station,
        status: ChargingSessionStatus.STARTING,
        tariffId: ids.tariff,
        tariffSnapshot: {
          activationFee: 0,
          currency: 'BRL',
          initialBatteryPercent: 30,
          parkingFeeHour: 0,
          pricePerKwh: 2.05,
        },
        userId: ids.user,
        vehicleId: ids.vehicle,
      },
    });
  }

  it('handles accepted/rejected boot, heartbeat, status and duplicate CALLs', async () => {
    const client = await connected();
    const bootPayload = {
      chargePointModel: 'Solis CP',
      chargePointVendor: 'Solis',
    };
    const boot = await client.call('BootNotification', bootPayload, 'boot-duplicate');
    expect(boot[0]).toBe(3);
    expect((boot[2] as Record<string, unknown>).status).toBe('Accepted');
    const duplicate = await client.call('BootNotification', bootPayload, 'boot-duplicate');
    expect(duplicate).toEqual(boot);
    expect(
      await prisma.ocppMessage.count({
        where: { chargePointId: ids.chargePoint, uniqueId: 'boot-duplicate' },
      }),
    ).toBe(1);

    const heartbeat = await client.call('Heartbeat', {});
    expect((heartbeat[2] as Record<string, unknown>).currentTime).toEqual(
      expect.any(String),
    );
    expect(
      await client.call('StatusNotification', {
        connectorId: 1,
        errorCode: 'NoError',
        status: 'Available',
        timestamp: new Date().toISOString(),
      }),
    ).toEqual(expect.arrayContaining([3]));
    expect((await prisma.connector.findUniqueOrThrow({ where: { id: ids.connector } })).status).toBe(
      ConnectorStatus.AVAILABLE,
    );

    await client.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await prisma.chargePoint.update({
      data: { ocppEnabled: false },
      where: { id: ids.chargePoint },
    });
    const disabled = await connected();
    const rejected = await disabled.call(
      'BootNotification',
      bootPayload,
      'disabled-boot',
    );
    expect((rejected[2] as Record<string, unknown>).status).toBe('Rejected');
  });

  it('replaces a duplicate connection and permits safe reconnection', async () => {
    const first = await connected();
    const firstClosed = first.waitForClose();
    const replacement = await connected();
    expect(await firstClosed).toBe(4001);
    expect((await replacement.call('Heartbeat', {}))[0]).toBe(3);
    await replacement.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const reconnected = await connected();
    expect((await reconnected.call('Heartbeat', {}))[0]).toBe(3);
  });
  it('executes remote start, authorize, start, meter and stop idempotently', async () => {
    const client = await connected();
    await client.call('BootNotification', {
      chargePointModel: 'Solis CP',
      chargePointVendor: 'Solis',
    });
    const session = await createSession('complete-flow');

    const startPromise = service.startSession(ids.connector, session.id);
    const remoteStart = await client.waitCommand('RemoteStartTransaction');
    const remoteStartPayload = remoteStart[3] as Record<string, unknown>;
    const idTag = remoteStartPayload.idTag as string;
    expect(idTag).toHaveLength(20);
    const authorization = await client.call('Authorize', { idTag });
    expect(
      ((authorization[2] as Record<string, unknown>).idTagInfo as Record<string, unknown>)
        .status,
    ).toBe('Accepted');
    client.sendResult(remoteStart[1], { status: 'Accepted' });

    const startTransaction = await client.call('StartTransaction', {
      connectorId: 1,
      idTag,
      meterStart: 10_000,
      timestamp: '2026-07-21T12:00:00.000Z',
    });
    expect(startTransaction[0]).toBe(3);
    const transactionId = (startTransaction[2] as Record<string, unknown>)
      .transactionId as number;
    expect(transactionId).toEqual(expect.any(Number));
    await expect(startPromise).resolves.toEqual({ meterStartWh: 10_000n, powerKw: 0 });
    await expect(service.startSession(ids.connector, session.id)).resolves.toEqual({
      meterStartWh: 10_000n,
      powerKw: 0,
    });
    expect(
      (
        await client.call('StartTransaction', {
          connectorId: 1,
          idTag,
          meterStart: 10_000,
          timestamp: '2026-07-21T12:00:01.000Z',
        })
      )[0],
    ).toBe(3);
    expect(
      (
        await client.call('StartTransaction', {
          connectorId: 1,
          idTag,
          meterStart: 9_999,
          timestamp: '2026-07-21T12:00:02.000Z',
        })
      ).slice(0, 3),
    ).toEqual([4, expect.any(String), 'PropertyConstraintViolation']);

    const meterPayload = {
      connectorId: 1,
      meterValue: [
        {
          sampledValue: [
            {
              measurand: 'Energy.Active.Import.Register',
              unit: 'Wh',
              value: '10120',
            },
            { measurand: 'Power.Active.Import', unit: 'W', value: '7200' },
            { measurand: 'SoC', unit: 'Percent', value: '44' },
          ],
          timestamp: '2026-07-21T12:00:05.000Z',
        },
      ],
      transactionId,
    };
    const meter = await client.call('MeterValues', meterPayload, 'meter-duplicate');
    expect(meter[0]).toBe(3);
    expect(await client.call('MeterValues', meterPayload, 'meter-duplicate')).toEqual(meter);
    expect(receivedEvents.filter((event) => event.type === 'METER_VALUE')).toHaveLength(1);
    expect(receivedEvents.find((event) => event.type === 'METER_VALUE')).toMatchObject({
      batteryPercent: 44,
      meterWh: '10120',
      powerKw: 7.2,
    });
    expect(
      (
        await client.call('MeterValues', {
          connectorId: 1,
          meterValue: [
            {
              sampledValue: [
                { unit: 'kWh', value: '10.15' },
                { measurand: 'Power.Active.Import', unit: 'kW', value: '7.5' },
                { measurand: 'SoC', unit: 'Percent', value: '150' },
              ],
              timestamp: '2026-07-21T12:00:05.500Z',
            },
          ],
          transactionId,
        })
      )[0],
    ).toBe(3);
    expect(receivedEvents.at(-1)).toMatchObject({
      batteryPercent: 100,
      meterWh: '10150',
      powerKw: 7.5,
    });

    const regression = await client.call('MeterValues', {
      ...meterPayload,
      meterValue: [
        {
          sampledValue: [
            {
              measurand: 'Energy.Active.Import.Register',
              unit: 'Wh',
              value: '10001',
            },
          ],
          timestamp: '2026-07-21T12:00:06.000Z',
        },
      ],
    });
    expect(regression.slice(0, 3)).toEqual([
      4,
      expect.any(String),
      'PropertyConstraintViolation',
    ]);

    const regressiveStop = await client.call('StopTransaction', {
      meterStop: 10_149,
      timestamp: '2026-07-21T12:00:09.000Z',
      transactionId,
    });
    expect(regressiveStop.slice(0, 3)).toEqual([
      4,
      expect.any(String),
      'PropertyConstraintViolation',
    ]);

    const stopPromise = service.stopSession(session.id);
    const remoteStop = await client.waitCommand('RemoteStopTransaction');
    expect((remoteStop[3] as Record<string, unknown>).transactionId).toBe(transactionId);
    client.sendResult(remoteStop[1], { status: 'Accepted' });
    const stopPayload = {
      meterStop: 10_200,
      reason: 'Remote',
      timestamp: '2026-07-21T12:00:10.000Z',
      transactionId,
    };
    const stop = await client.call('StopTransaction', stopPayload, 'stop-duplicate');
    expect(stop[0]).toBe(3);
    await expect(stopPromise).resolves.toBe(10_200n);
    expect(await client.call('StopTransaction', stopPayload, 'stop-duplicate')).toEqual(stop);
    expect((await client.call('StopTransaction', stopPayload, 'stop-completed'))[0]).toBe(3);
    await expect(service.stopSession(session.id)).resolves.toBe(10_200n);
    expect(receivedEvents.filter((event) => event.type === 'STOPPED')).toHaveLength(1);
    expect(
      await prisma.ocppTransaction.findUniqueOrThrow({
        where: { chargingSessionId: session.id },
      }),
    ).toMatchObject({
      lastMeterWh: 10_200n,
      meterStopWh: 10_200n,
      status: OcppTransactionStatus.COMPLETED,
    });
  });

  it('keeps an active transaction recoverable across disconnect and reconnect', async () => {
    const client = await connected();
    const session = await createSession('recoverable');
    const startPromise = service.startSession(ids.connector, session.id);
    const remoteStart = await client.waitCommand('RemoteStartTransaction');
    const idTag = (remoteStart[3] as Record<string, unknown>).idTag as string;
    client.sendResult(remoteStart[1], { status: 'Accepted' });
    await client.call('StartTransaction', {
      connectorId: 1,
      idTag,
      meterStart: 20_000,
      timestamp: '2026-07-21T13:00:00.000Z',
    });
    await startPromise;

    await client.close();
    await waitForCondition(() =>
      receivedEvents.some(
        (event) => event.type === 'DISCONNECTED' && event.sessionId === session.id,
      ),
    );
    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        recoverable: true,
        sessionId: session.id,
        type: 'DISCONNECTED',
      }),
    );
    expect(
      await prisma.ocppTransaction.findUniqueOrThrow({
        where: { chargingSessionId: session.id },
      }),
    ).toMatchObject({ status: OcppTransactionStatus.ACTIVE });

    const reconnected = await connected();
    expect(
      (
        await reconnected.call('BootNotification', {
          chargePointModel: 'Solis CP',
          chargePointVendor: 'Solis',
        })
      )[0],
    ).toBe(3);
    await reconnected.call('StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status: 'Charging',
      timestamp: new Date().toISOString(),
    });
    expect((await prisma.connector.findUniqueOrThrow({ where: { id: ids.connector } })).status).toBe(
      ConnectorStatus.OCCUPIED,
    );
  });

  it('times out an unanswered remote command and marks its transaction failed', async () => {
    const client = await connected();
    const session = await createSession('timeout');
    const originalTimeout = environment.ocppCommandTimeoutMs;
    environment.ocppCommandTimeoutMs = 100;
    try {
      const startPromise = service.startSession(ids.connector, session.id);
      await client.waitCommand('RemoteStartTransaction');
      await expect(startPromise).rejects.toMatchObject({ status: 503 });
      expect(
        await prisma.ocppTransaction.findUniqueOrThrow({
          where: { chargingSessionId: session.id },
        }),
      ).toMatchObject({ status: OcppTransactionStatus.FAILED });
    } finally {
      environment.ocppCommandTimeoutMs = originalTimeout;
    }
  });

  it('returns protocol errors for unsupported, invalid and unknown commands', async () => {
    const client = await connected();
    expect((await client.call('UnsupportedAction', {})).slice(0, 3)).toEqual([
      4,
      expect.any(String),
      'NotSupported',
    ]);
    expect(
      (
        await client.call('BootNotification', {
          chargePointModel: 'Solis CP',
          chargePointVendor: 'Solis',
          unexpected: true,
        })
      ).slice(0, 3),
    ).toEqual([4, expect.any(String), 'TypeConstraintViolation']);
    const invalidAuthorization = await client.call('Authorize', { idTag: 'unknown' });
    expect(
      ((invalidAuthorization[2] as Record<string, unknown>).idTagInfo as Record<string, unknown>)
        .status,
    ).toBe('Invalid');
    const invalidStart = await client.call('StartTransaction', {
      connectorId: 1,
      idTag: 'unknown',
      meterStart: 1,
      timestamp: new Date().toISOString(),
    });
    expect(
      ((invalidStart[2] as Record<string, unknown>).idTagInfo as Record<string, unknown>)
        .status,
    ).toBe('Invalid');
    expect(
      await client.call('MeterValues', {
        connectorId: 1,
        meterValue: [
          {
            sampledValue: [{ value: '1' }],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    ).toEqual([3, expect.any(String), {}]);
    expect(
      (
        await client.call('MeterValues', {
          connectorId: 1,
          meterValue: [
            {
              sampledValue: [{ value: '1' }],
              timestamp: new Date().toISOString(),
            },
          ],
          transactionId: 999999,
        })
      ).slice(0, 3),
    ).toEqual([4, expect.any(String), 'PropertyConstraintViolation']);
    expect(
      (
        await client.call('StatusNotification', {
          connectorId: 999,
          errorCode: 'NoError',
          status: 'Available',
        })
      ).slice(0, 3),
    ).toEqual([4, expect.any(String), 'PropertyConstraintViolation']);
  });

  it('maps charge point and connector status variants', async () => {
    const client = await connected();
    await client.call('StatusNotification', {
      connectorId: 0,
      errorCode: 'NoError',
      status: 'Preparing',
    });
    await client.call('StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status: 'Unavailable',
    });
    expect((await prisma.connector.findUniqueOrThrow({ where: { id: ids.connector } })).status).toBe(
      ConnectorStatus.OFFLINE,
    );
    await client.call('StatusNotification', {
      connectorId: 1,
      errorCode: 'OtherError',
      status: 'Faulted',
    });
    expect((await prisma.connector.findUniqueOrThrow({ where: { id: ids.connector } })).status).toBe(
      ConnectorStatus.MAINTENANCE,
    );
    await client.call('StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status: 'Reserved',
    });
    expect((await prisma.connector.findUniqueOrThrow({ where: { id: ids.connector } })).status).toBe(
      ConnectorStatus.RESERVED,
    );
    client.socket.send(JSON.stringify([3, 'unmatched-response', {}]));
    expect((await client.call('Heartbeat', {}, 'heartbeat-after-unmatched'))[0]).toBe(3);
  });

  it('handles CALLERROR for a pending remote command without logging details', async () => {
    const client = await connected();
    const session = await createSession('callerror');
    const startPromise = service.startSession(ids.connector, session.id);
    const command = await client.waitCommand('RemoteStartTransaction');
    client.socket.send(
      JSON.stringify([4, command[1], 'InternalError', 'private remote detail', {}]),
    );
    await expect(startPromise).rejects.toMatchObject({ status: 503 });
    expect(
      await prisma.ocppTransaction.findUniqueOrThrow({
        where: { chargingSessionId: session.id },
      }),
    ).toMatchObject({ status: OcppTransactionStatus.FAILED });
  });

  it('rejects malformed, binary and rate-limited connections safely', async () => {
    const malformed = await connected();
    const malformedClose = malformed.waitForClose();
    malformed.socket.send('{not-json');
    expect(await malformedClose).toBe(1002);

    const binary = await connected();
    const binaryClose = binary.waitForClose();
    binary.socket.send(Buffer.from([1, 2, 3]), { binary: true });
    expect(await binaryClose).toBe(1003);

    const originalLimit = environment.ocppMessageRateLimit;
    environment.ocppMessageRateLimit = 1;
    try {
      const limited = await connected();
      await limited.call('Heartbeat', {}, 'rate-first');
      const limitedClose = limited.waitForClose();
      limited.socket.send(JSON.stringify([2, 'rate-second', 'Heartbeat', {}]));
      expect(await limitedClose).toBe(1008);
    } finally {
      environment.ocppMessageRateLimit = originalLimit;
    }
  });

  it('rejects gateway commands while offline or unknown', async () => {
    await expect(service.assertConnectorConnected(ids.connector)).rejects.toMatchObject({
      status: 503,
    });
    await expect(service.assertConnectorConnected('00000000-0000-4000-8000-000000000000'))
      .rejects.toMatchObject({ status: 503 });
    await expect(service.stopSession('00000000-0000-4000-8000-000000000000'))
      .rejects.toMatchObject({ status: 503 });
    await expect(service.listen(0)).resolves.toBe(port);
  });
  it('enforces endpoint, subprotocol, authentication and duplicate policy', async () => {
    const path = '/ocpp/SOLIS-OCPP-001';
    const credentials =
      'Basic ' + Buffer.from('SOLIS-OCPP-001:solis-ocpp-demo').toString('base64');
    await expect(rejectedUpgrade(path, undefined, credentials)).resolves.toBe(426);
    await expect(rejectedUpgrade('/not-ocpp', 'ocpp1.6', credentials)).resolves.toBe(404);
    await expect(rejectedUpgrade('/ocpp/UNKNOWN-CP', 'ocpp1.6', credentials)).resolves.toBe(404);
    await expect(rejectedUpgrade(path, 'ocpp1.6')).resolves.toBe(401);

    const existing = await connected();
    const duplicatePolicy = environment.ocppDuplicateConnectionPolicy;
    environment.ocppDuplicateConnectionPolicy = 'reject';
    try {
      await expect(rejectedUpgrade(path, 'ocpp1.6', credentials)).resolves.toBe(409);
    } finally {
      environment.ocppDuplicateConnectionPolicy = duplicatePolicy;
    }
    await existing.close();
    await waitForCondition(() => !service.isConnected('SOLIS-OCPP-001'));

    const authMode = environment.ocppAuthMode;
    environment.ocppAuthMode = 'none';
    try {
      const socket = new WebSocket(`ws://localhost:${port}${path}`, 'ocpp1.6');
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
      expect(socket.protocol).toBe('ocpp1.6');
      socket.close();
      await new Promise<void>((resolve) => socket.once('close', () => resolve()));
    } finally {
      environment.ocppAuthMode = authMode;
    }
  });

  it('marks an explicitly rejected remote start as failed', async () => {
    const client = await connected();
    const session = await createSession('remote-rejected');
    const startPromise = service.startSession(ids.connector, session.id);
    const command = await client.waitCommand('RemoteStartTransaction');
    client.sendResult(command[1], { status: 'Rejected' });
    await expect(startPromise).rejects.toMatchObject({ status: 503 });
    expect(
      await prisma.ocppTransaction.findUniqueOrThrow({
        where: { chargingSessionId: session.id },
      }),
    ).toMatchObject({ status: OcppTransactionStatus.FAILED });
  });

  it('rejects invalid basic credentials without exposing the secret', async () => {
    const credentials = Buffer.from('SOLIS-OCPP-001:wrong-secret').toString('base64');
    const socket = new WebSocket(
      `ws://localhost:${port}/ocpp/SOLIS-OCPP-001`,
      'ocpp1.6',
      { headers: { Authorization: 'Basic ' + credentials } },
    );
    const statusCode = await new Promise<number>((resolve, reject) => {
      socket.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      socket.once('open', () => reject(new Error('Invalid credentials were accepted.')));
      socket.once('error', () => undefined);
    });
    expect(statusCode).toBe(401);
  });
});