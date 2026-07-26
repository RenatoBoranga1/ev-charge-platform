import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ChargePointConnectionStatus,
  ChargerProtocol,
  ConnectorStatus,
  OcppMessageDirection,
  OcppTransactionStatus,
  Prisma,
  StationStatus,
} from '@solis/database';
import * as argon2 from 'argon2';
import { ZodError } from 'zod';
import WebSocket, { WebSocketServer, type RawData } from 'ws';

import { ChargerEventRelay } from '../charging/gateway/charger-event-relay';
import { environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import {
  callError,
  callResult,
  type OcppCall,
  type OcppFrame,
  type OcppJsonObject,
  OcppProtocolError,
  parseOcppFrame,
  serializeOcppFrame,
} from './ocpp16-frame';
import {
  authorizeSchema,
  bootNotificationSchema,
  heartbeatSchema,
  meterValuesSchema,
  remoteStartResponseSchema,
  remoteStopResponseSchema,
  startTransactionSchema,
  statusNotificationSchema,
  stopTransactionSchema,
  type MeterValuesPayload,
} from './ocpp16-payloads';

interface ConnectionContext {
  alive: boolean;
  chargePointId: string;
  identity: string;
  lastActivityAt: number;
  messagesInWindow: number;
  ocppEnabled: boolean;
  processing: Promise<void>;
  rateWindowStartedAt: number;
}

interface ActiveConnection {
  context: ConnectionContext;
  socket: WebSocket;
}

interface PendingCommand {
  action: string;
  chargePointId: string;
  reject: (error: Error) => void;
  resolve: (payload: OcppJsonObject) => void;
  timer: NodeJS.Timeout;
}

interface PendingValue<T> {
  reject: (error: Error) => void;
  resolve: (value: T) => void;
  timer: NodeJS.Timeout;
}

export interface OcppStartResult {
  meterStartWh: bigint;
  powerKw: number;
}

class UpgradeRejection extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

function tokenHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function rawDataToText(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

function safeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new OcppProtocolError(
      'PropertyConstraintViolation',
      'Meter sample must be a non-negative number.',
    );
  }
  return parsed;
}

@Injectable()
export class Ocpp16CentralSystemService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(Ocpp16CentralSystemService.name);
  private readonly connections = new Map<string, ActiveConnection>();
  private readonly verifiedRequests = new WeakMap<IncomingMessage, ConnectionContext>();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private readonly pendingStarts = new Map<string, PendingValue<OcppStartResult>>();
  private readonly pendingStops = new Map<string, PendingValue<bigint>>();
  private readonly inboundCalls = new Map<string, Promise<OcppFrame>>();
  private server?: WebSocketServer;
  private idleTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ChargerEventRelay,
  ) {}

  async onModuleInit(): Promise<void> {
    if (environment.ocppEnabled) await this.listen(environment.ocppPort);
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async listen(port: number): Promise<number> {
    if (this.server) {
      const address = this.server.address() as AddressInfo | null;
      return address?.port ?? port;
    }

    const server = new WebSocketServer({
      handleProtocols: (protocols) =>
        protocols.has('ocpp1.6') ? 'ocpp1.6' : false,
      maxPayload: environment.ocppMaxPayloadBytes,
      perMessageDeflate: false,
      port,
      verifyClient: (info, done) => {
        void this.verifyUpgrade(info.req)
          .then((context) => {
            this.verifiedRequests.set(info.req, context);
            done(true);
          })
          .catch((error: unknown) => {
            const rejection =
              error instanceof UpgradeRejection
                ? error
                : new UpgradeRejection(500, 'WebSocket upgrade failed.');
            done(false, rejection.statusCode, rejection.message, rejection.headers);
          });
      },
    });

    server.on('connection', (socket, request) => {
      this.acceptConnection(socket, request);
    });
    server.on('error', (error) => {
      this.log('error', 'ocpp.server.error', undefined, { errorName: error.name });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    this.server = server;
    this.idleTimer = setInterval(
      () => this.checkIdleConnections(),
      Math.min(Math.max(Math.floor(environment.ocppIdleTimeoutMs / 2), 1_000), 30_000),
    );
    this.idleTimer.unref();
    const address = server.address() as AddressInfo;
    this.log('log', 'ocpp.server.listening', undefined, { port: address.port });
    return address.port;
  }

  async close(): Promise<void> {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = undefined;
    for (const connection of this.connections.values()) {
      connection.socket.close(1001, 'Server shutting down');
    }
    this.connections.clear();
    for (const pending of this.pendingCommands.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('OCPP server shutting down.'));
    }
    this.pendingCommands.clear();
    if (!this.server) return;
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  async assertConnectorConnected(connectorId: string): Promise<void> {
    const connector = await this.loadOcppConnector(connectorId);
    const identity = connector.evse.chargePoint.ocppIdentity;
    if (!identity || !this.isConnected(identity)) {
      throw new ServiceUnavailableException({
        code: 'OCPP_CHARGE_POINT_OFFLINE',
        message: 'The OCPP charge point is not connected.',
      });
    }
  }

  async startSession(connectorId: string, sessionId: string): Promise<OcppStartResult> {
    const connector = await this.loadOcppConnector(connectorId);
    const chargePoint = connector.evse.chargePoint;
    const identity = chargePoint.ocppIdentity;
    if (!identity || !this.isConnected(identity)) {
      throw new ServiceUnavailableException({
        code: 'OCPP_CHARGE_POINT_OFFLINE',
        message: 'The OCPP charge point is not connected.',
      });
    }

    const existing = await this.prisma.ocppTransaction.findUnique({
      where: { chargingSessionId: sessionId },
    });
    if (existing?.status === OcppTransactionStatus.ACTIVE && existing.meterStartWh !== null) {
      return { meterStartWh: existing.meterStartWh, powerKw: 0 };
    }

    const authorizationToken = randomBytes(15).toString('base64url').slice(0, 20);
    const authorizationTokenHash = tokenHash(authorizationToken);
    await this.prisma.ocppTransaction.upsert({
      create: {
        authorizationTokenHash,
        chargePointId: chargePoint.id,
        chargingSessionId: sessionId,
        connectorId,
        status: OcppTransactionStatus.REMOTE_START_PENDING,
      },
      update: {
        authorizationTokenHash,
        chargePointId: chargePoint.id,
        connectorId,
        failureReason: null,
        status: OcppTransactionStatus.REMOTE_START_PENDING,
        version: { increment: 1 },
      },
      where: { chargingSessionId: sessionId },
    });

    try {
      const response = remoteStartResponseSchema.parse(
        await this.sendCall(identity, 'RemoteStartTransaction', {
          connectorId: connector.number,
          idTag: authorizationToken,
        }),
      );
      if (response.status !== 'Accepted') {
        throw new Error('RemoteStartTransaction was rejected.');
      }
      return await this.waitForStart(sessionId);
    } catch (error) {
      await this.markTransactionFailed(sessionId, error);
      throw new ServiceUnavailableException({
        code: 'OCPP_REMOTE_START_FAILED',
        message: error instanceof Error ? error.message : 'Remote start failed.',
      });
    }
  }

  async stopSession(sessionId: string): Promise<bigint> {
    const transaction = await this.prisma.ocppTransaction.findUnique({
      include: { chargePoint: true },
      where: { chargingSessionId: sessionId },
    });
    if (!transaction) {
      throw new ServiceUnavailableException({
        code: 'OCPP_TRANSACTION_NOT_FOUND',
        message: 'OCPP transaction was not found.',
      });
    }
    if (transaction.status === OcppTransactionStatus.COMPLETED && transaction.meterStopWh !== null) {
      return transaction.meterStopWh;
    }
    const identity = transaction.chargePoint.ocppIdentity;
    if (!identity || !this.isConnected(identity)) {
      throw new ServiceUnavailableException({
        code: 'OCPP_CHARGE_POINT_OFFLINE',
        message: 'The OCPP charge point is not connected.',
      });
    }

    await this.prisma.ocppTransaction.update({
      data: { status: OcppTransactionStatus.STOPPING, version: { increment: 1 } },
      where: { id: transaction.id },
    });
    try {
      const response = remoteStopResponseSchema.parse(
        await this.sendCall(identity, 'RemoteStopTransaction', {
          transactionId: transaction.protocolTransactionId,
        }),
      );
      if (response.status !== 'Accepted') {
        throw new Error('RemoteStopTransaction was rejected.');
      }
      return await this.waitForStop(sessionId);
    } catch (error) {
      await this.markTransactionFailed(sessionId, error);
      throw new ServiceUnavailableException({
        code: 'OCPP_REMOTE_STOP_FAILED',
        message: error instanceof Error ? error.message : 'Remote stop failed.',
      });
    }
  }

  isConnected(identity: string): boolean {
    return this.connections.get(identity)?.socket.readyState === WebSocket.OPEN;
  }

  private async verifyUpgrade(request: IncomingMessage): Promise<ConnectionContext> {
    const protocols = String(request.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((value) => value.trim());
    if (!protocols.includes('ocpp1.6')) {
      throw new UpgradeRejection(426, 'Subprotocol ocpp1.6 is required.', {
        'Sec-WebSocket-Protocol': 'ocpp1.6',
      });
    }

    const url = new URL(request.url ?? '/', 'http://ocpp.local');
    const match = /^\/ocpp\/([^/]+)$/.exec(url.pathname);
    if (!match?.[1]) throw new UpgradeRejection(404, 'Unknown OCPP endpoint.');
    let identity: string;
    try {
      identity = decodeURIComponent(match[1]);
    } catch {
      throw new UpgradeRejection(400, 'Invalid charge point identity.');
    }
    if (!identity || identity.length > 64) {
      throw new UpgradeRejection(400, 'Invalid charge point identity.');
    }

    const chargePoint = await this.prisma.chargePoint.findFirst({
      where: { deletedAt: null, ocppIdentity: identity, protocol: ChargerProtocol.OCPP16 },
    });
    if (!chargePoint) throw new UpgradeRejection(404, 'Unknown charge point.');
    if (environment.ocppDuplicateConnectionPolicy === 'reject' && this.isConnected(identity)) {
      throw new UpgradeRejection(409, 'Charge point is already connected.');
    }
    if (environment.ocppAuthMode === 'basic') {
      await this.verifyBasicAuthentication(
        request.headers.authorization,
        identity,
        chargePoint.ocppAuthSecretHash,
      );
    }

    const now = Date.now();
    return {
      alive: true,
      chargePointId: chargePoint.id,
      identity,
      lastActivityAt: now,
      messagesInWindow: 0,
      ocppEnabled: chargePoint.ocppEnabled,
      processing: Promise.resolve(),
      rateWindowStartedAt: now,
    };
  }

  private async verifyBasicAuthentication(
    authorization: string | undefined,
    identity: string,
    secretHash: string | null,
  ): Promise<void> {
    if (!authorization?.startsWith('Basic ') || !secretHash) {
      throw new UpgradeRejection(401, 'Authentication required.', {
        'WWW-Authenticate': 'Basic realm="solis-ocpp"',
      });
    }
    let decoded: string;
    try {
      decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    } catch {
      throw new UpgradeRejection(401, 'Invalid credentials.');
    }
    const separator = decoded.indexOf(':');
    const username = separator >= 0 ? decoded.slice(0, separator) : '';
    const password = separator >= 0 ? decoded.slice(separator + 1) : '';
    if (username !== identity || !(await argon2.verify(secretHash, password))) {
      throw new UpgradeRejection(401, 'Invalid credentials.');
    }
  }
  private acceptConnection(socket: WebSocket, request: IncomingMessage): void {
    const context = this.verifiedRequests.get(request);
    if (!context) {
      socket.close(1008, 'Connection was not verified');
      return;
    }

    const existing = this.connections.get(context.identity);
    this.connections.set(context.identity, { context, socket });
    if (existing && existing.socket !== socket) {
      existing.socket.close(4001, 'Replaced by a newer connection');
    }

    socket.on('pong', () => {
      context.alive = true;
      context.lastActivityAt = Date.now();
    });
    socket.on('message', (data, isBinary) => {
      context.processing = context.processing
        .then(() => this.handleRawMessage(context, socket, data, isBinary))
        .catch((error: unknown) => {
          this.log('error', 'ocpp.message.unhandled', context, {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
        });
    });
    socket.on('close', () => {
      void this.handleDisconnect(context, socket);
    });
    socket.on('error', (error) => {
      this.log('warn', 'ocpp.connection.error', context, { errorName: error.name });
    });

    void this.prisma.chargePoint.update({
      data: {
        connectionStatus: ChargePointConnectionStatus.CONNECTED,
        lastSeenAt: new Date(),
        version: { increment: 1 },
      },
      where: { id: context.chargePointId },
    });
    this.log('log', 'ocpp.connection.opened', context);
  }

  private async handleRawMessage(
    context: ConnectionContext,
    socket: WebSocket,
    data: RawData,
    isBinary: boolean,
  ): Promise<void> {
    if (isBinary) {
      socket.close(1003, 'Binary frames are not supported');
      return;
    }
    if (!this.consumeRateLimit(context)) {
      this.log('warn', 'ocpp.connection.rate_limited', context);
      socket.close(1008, 'Message rate exceeded');
      return;
    }
    context.lastActivityAt = Date.now();
    context.alive = true;

    let frame: OcppFrame;
    try {
      frame = parseOcppFrame(rawDataToText(data), environment.ocppMaxPayloadBytes);
    } catch (error) {
      this.log('warn', 'ocpp.frame.rejected', context, {
        errorCode:
          error instanceof OcppProtocolError ? error.errorCode : 'FormationViolation',
      });
      socket.close(1002, 'Malformed OCPP frame');
      return;
    }

    if (frame[0] === 2) {
      const response = await this.processIncomingCall(context, frame);
      this.sendFrame(socket, response);
      return;
    }
    await this.processCommandResponse(context, frame);
  }

  private consumeRateLimit(context: ConnectionContext): boolean {
    const now = Date.now();
    if (now - context.rateWindowStartedAt >= 60_000) {
      context.rateWindowStartedAt = now;
      context.messagesInWindow = 0;
    }
    context.messagesInWindow += 1;
    return context.messagesInWindow <= environment.ocppMessageRateLimit;
  }

  private async processIncomingCall(
    context: ConnectionContext,
    call: OcppCall,
  ): Promise<OcppFrame> {
    const key = context.chargePointId + ':' + call[1];
    const active = this.inboundCalls.get(key);
    if (active) return active;
    const processing = this.executeIncomingCall(context, call).finally(() => {
      this.inboundCalls.delete(key);
    });
    this.inboundCalls.set(key, processing);
    return processing;
  }

  private async executeIncomingCall(
    context: ConnectionContext,
    call: OcppCall,
  ): Promise<OcppFrame> {
    const cached = await this.prisma.ocppMessage.findUnique({
      where: {
        chargePointId_direction_uniqueId: {
          chargePointId: context.chargePointId,
          direction: OcppMessageDirection.CHARGE_POINT_TO_CSMS,
          uniqueId: call[1],
        },
      },
    });
    if (cached?.response) return cached.response as unknown as OcppFrame;

    let response: OcppFrame;
    try {
      const payload = await this.dispatchCall(context, call[2], call[3], call[1]);
      response = callResult(call[1], payload);
    } catch (error) {
      const protocolError =
        error instanceof OcppProtocolError
          ? error
          : error instanceof ZodError
            ? new OcppProtocolError('TypeConstraintViolation', 'Payload validation failed.', {
                issues: error.issues.map((issue) => ({
                  code: issue.code,
                  path: issue.path.join('.'),
                })),
              })
            : new OcppProtocolError('InternalError', 'The command could not be processed.');
      response = callError(call[1], protocolError);
    }

    try {
      await this.prisma.ocppMessage.create({
        data: {
          action: call[2],
          chargePointId: context.chargePointId,
          correlationId: call[1],
          direction: OcppMessageDirection.CHARGE_POINT_TO_CSMS,
          response: response as unknown as Prisma.InputJsonValue,
          uniqueId: call[1],
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      const duplicate = await this.prisma.ocppMessage.findUnique({
        where: {
          chargePointId_direction_uniqueId: {
            chargePointId: context.chargePointId,
            direction: OcppMessageDirection.CHARGE_POINT_TO_CSMS,
            uniqueId: call[1],
          },
        },
      });
      if (duplicate?.response) return duplicate.response as unknown as OcppFrame;
    }
    this.log('log', 'ocpp.call.processed', context, {
      action: call[2],
      correlationId: call[1],
      resultType: response[0],
    });
    return response;
  }

  private async dispatchCall(
    context: ConnectionContext,
    action: string,
    payload: OcppJsonObject,
    correlationId: string,
  ): Promise<OcppJsonObject> {
    await this.touch(context);
    switch (action) {
      case 'BootNotification': {
        bootNotificationSchema.parse(payload);
        return {
          currentTime: new Date().toISOString(),
          interval: environment.ocppHeartbeatIntervalSeconds,
          status: context.ocppEnabled ? 'Accepted' : 'Rejected',
        };
      }
      case 'Heartbeat':
        heartbeatSchema.parse(payload);
        return { currentTime: new Date().toISOString() };
      case 'StatusNotification':
        return this.handleStatusNotification(context, payload);
      case 'Authorize':
        return this.handleAuthorize(context, payload);
      case 'StartTransaction':
        return this.handleStartTransaction(context, payload);
      case 'MeterValues':
        return this.handleMeterValues(context, payload, correlationId);
      case 'StopTransaction':
        return this.handleStopTransaction(context, payload, correlationId);
      default:
        throw new OcppProtocolError('NotSupported', 'OCPP action is not supported.');
    }
  }

  private async handleStatusNotification(
    context: ConnectionContext,
    raw: OcppJsonObject,
  ): Promise<OcppJsonObject> {
    const payload = statusNotificationSchema.parse(raw);
    const connectorStatus = this.mapConnectorStatus(payload.status);
    const chargePointStatus = this.mapChargePointStatus(payload.status);
    if (payload.connectorId === 0) {
      await this.prisma.chargePoint.update({
        data: { status: chargePointStatus, version: { increment: 1 } },
        where: { id: context.chargePointId },
      });
      return {};
    }

    const connector = await this.prisma.connector.findFirst({
      where: {
        deletedAt: null,
        number: payload.connectorId,
        evse: { chargePointId: context.chargePointId },
      },
    });
    if (!connector) {
      throw new OcppProtocolError(
        'PropertyConstraintViolation',
        'Connector does not belong to this charge point.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.connector.update({
        data: { status: connectorStatus, version: { increment: 1 } },
        where: { id: connector.id },
      }),
      this.prisma.evse.update({
        data: { status: connectorStatus, version: { increment: 1 } },
        where: { id: connector.evseId },
      }),
      this.prisma.chargePoint.update({
        data: { status: chargePointStatus, version: { increment: 1 } },
        where: { id: context.chargePointId },
      }),
    ]);
    return {};
  }

  private async handleAuthorize(
    context: ConnectionContext,
    raw: OcppJsonObject,
  ): Promise<OcppJsonObject> {
    const payload = authorizeSchema.parse(raw);
    const transaction = await this.prisma.ocppTransaction.findFirst({
      where: {
        authorizationTokenHash: tokenHash(payload.idTag),
        chargePointId: context.chargePointId,
        status: {
          in: [
            OcppTransactionStatus.REMOTE_START_PENDING,
            OcppTransactionStatus.ACTIVE,
            OcppTransactionStatus.STOPPING,
          ],
        },
      },
    });
    return { idTagInfo: { status: transaction ? 'Accepted' : 'Invalid' } };
  }

  private async handleStartTransaction(
    context: ConnectionContext,
    raw: OcppJsonObject,
  ): Promise<OcppJsonObject> {
    const payload = startTransactionSchema.parse(raw);
    const connector = await this.prisma.connector.findFirst({
      where: {
        deletedAt: null,
        number: payload.connectorId,
        evse: { chargePointId: context.chargePointId },
      },
    });
    if (!connector) {
      throw new OcppProtocolError('PropertyConstraintViolation', 'Unknown connector.');
    }
    const transaction = await this.prisma.ocppTransaction.findFirst({
      where: {
        authorizationTokenHash: tokenHash(payload.idTag),
        chargePointId: context.chargePointId,
        connectorId: connector.id,
        status: {
          in: [OcppTransactionStatus.REMOTE_START_PENDING, OcppTransactionStatus.ACTIVE],
        },
      },
    });
    if (!transaction) {
      return { idTagInfo: { status: 'Invalid' }, transactionId: 0 };
    }
    const meterStartWh = BigInt(payload.meterStart);
    if (transaction.meterStartWh !== null && meterStartWh < transaction.meterStartWh) {
      throw new OcppProtocolError(
        'PropertyConstraintViolation',
        'Start meter cannot move backwards.',
      );
    }
    if (transaction.status !== OcppTransactionStatus.ACTIVE) {
      const updated = await this.prisma.ocppTransaction.updateMany({
        data: {
          lastMeterWh: meterStartWh,
          meterStartWh,
          startedAt: new Date(payload.timestamp),
          status: OcppTransactionStatus.ACTIVE,
          version: { increment: 1 },
        },
        where: {
          id: transaction.id,
          status: OcppTransactionStatus.REMOTE_START_PENDING,
          version: transaction.version,
        },
      });
      if (updated.count !== 1) {
        throw new OcppProtocolError('InternalError', 'Transaction start conflict.');
      }
    }
    this.resolveStart(transaction.chargingSessionId, { meterStartWh, powerKw: 0 });
    return {
      idTagInfo: { status: 'Accepted' },
      transactionId: transaction.protocolTransactionId,
    };
  }
  private async handleMeterValues(
    context: ConnectionContext,
    raw: OcppJsonObject,
    correlationId: string,
  ): Promise<OcppJsonObject> {
    const payload = meterValuesSchema.parse(raw);
    if (payload.transactionId === undefined) return {};
    let transaction = await this.prisma.ocppTransaction.findFirst({
      where: {
        chargePointId: context.chargePointId,
        protocolTransactionId: payload.transactionId,
        status: { in: [OcppTransactionStatus.ACTIVE, OcppTransactionStatus.STOPPING] },
      },
    });
    if (!transaction) {
      throw new OcppProtocolError('PropertyConstraintViolation', 'Unknown transaction.');
    }

    const samples = [...payload.meterValue].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp),
    );
    for (const sample of samples) {
      const values = this.extractMeterSample(sample, transaction.lastMeterWh);
      if (values.meterWh < (transaction.lastMeterWh ?? transaction.meterStartWh ?? 0n)) {
        throw new OcppProtocolError(
          'PropertyConstraintViolation',
          'Meter value cannot move backwards.',
        );
      }
      const updated = await this.prisma.ocppTransaction.updateMany({
        data: { lastMeterWh: values.meterWh, version: { increment: 1 } },
        where: { id: transaction.id, version: transaction.version },
      });
      if (updated.count !== 1) {
        throw new OcppProtocolError('InternalError', 'Meter update conflict.');
      }
      transaction = await this.prisma.ocppTransaction.findUniqueOrThrow({
        where: { id: transaction.id },
      });
      await this.events.publish(
        {
          batteryPercent: values.batteryPercent,
          meterWh: values.meterWh.toString(),
          occurredAt: sample.timestamp,
          powerKw: values.powerKw,
          sessionId: transaction.chargingSessionId,
          type: 'METER_VALUE',
        },
        correlationId,
      );
    }
    return {};
  }

  private extractMeterSample(
    sample: MeterValuesPayload['meterValue'][number],
    previous: bigint | null,
  ): { batteryPercent?: number; meterWh: bigint; powerKw: number } {
    let meterWh = previous;
    let powerKw = 0;
    let batteryPercent: number | undefined;
    for (const value of sample.sampledValue) {
      const measurand = value.measurand ?? 'Energy.Active.Import.Register';
      const numeric = safeNumber(value.value);
      if (measurand === 'Energy.Active.Import.Register') {
        const wh = value.unit === 'kWh' ? numeric * 1000 : numeric;
        meterWh = BigInt(Math.round(wh));
      } else if (measurand === 'Power.Active.Import') {
        powerKw = value.unit === 'kW' ? numeric : numeric / 1000;
      } else if (measurand === 'SoC') {
        batteryPercent = Math.min(100, Math.round(numeric));
      }
    }
    if (meterWh === null) {
      throw new OcppProtocolError(
        'OccurrenceConstraintViolation',
        'A cumulative energy sample is required.',
      );
    }
    return { batteryPercent, meterWh, powerKw };
  }

  private async handleStopTransaction(
    context: ConnectionContext,
    raw: OcppJsonObject,
    correlationId: string,
  ): Promise<OcppJsonObject> {
    const payload = stopTransactionSchema.parse(raw);
    const transaction = await this.prisma.ocppTransaction.findFirst({
      where: {
        chargePointId: context.chargePointId,
        protocolTransactionId: payload.transactionId,
      },
    });
    if (!transaction) {
      throw new OcppProtocolError('PropertyConstraintViolation', 'Unknown transaction.');
    }
    if (transaction.status === OcppTransactionStatus.COMPLETED) {
      return { idTagInfo: { status: 'Accepted' } };
    }
    const meterStopWh = BigInt(payload.meterStop);
    const lastMeter = transaction.lastMeterWh ?? transaction.meterStartWh ?? 0n;
    if (meterStopWh < lastMeter) {
      throw new OcppProtocolError(
        'PropertyConstraintViolation',
        'Stop meter cannot move backwards.',
      );
    }
    const updated = await this.prisma.ocppTransaction.updateMany({
      data: {
        lastMeterWh: meterStopWh,
        meterStopWh,
        status: OcppTransactionStatus.COMPLETED,
        stoppedAt: new Date(payload.timestamp),
        version: { increment: 1 },
      },
      where: {
        id: transaction.id,
        status: { in: [OcppTransactionStatus.ACTIVE, OcppTransactionStatus.STOPPING] },
        version: transaction.version,
      },
    });
    if (updated.count === 1) {
      await this.events.publish(
        {
          meterWh: meterStopWh.toString(),
          occurredAt: payload.timestamp,
          reason: payload.reason,
          sessionId: transaction.chargingSessionId,
          type: 'STOPPED',
        },
        correlationId,
      );
    }
    this.resolveStop(transaction.chargingSessionId, meterStopWh);
    return { idTagInfo: { status: 'Accepted' } };
  }

  private mapConnectorStatus(status: string): ConnectorStatus {
    if (status === 'Available') return ConnectorStatus.AVAILABLE;
    if (['Charging', 'SuspendedEV', 'SuspendedEVSE'].includes(status)) {
      return ConnectorStatus.OCCUPIED;
    }
    if (['Preparing', 'Finishing', 'Reserved'].includes(status)) {
      return ConnectorStatus.RESERVED;
    }
    if (status === 'Unavailable') return ConnectorStatus.OFFLINE;
    return ConnectorStatus.MAINTENANCE;
  }

  private mapChargePointStatus(status: string): StationStatus {
    if (status === 'Available') return StationStatus.AVAILABLE;
    if (['Charging', 'SuspendedEV', 'SuspendedEVSE'].includes(status)) {
      return StationStatus.OCCUPIED;
    }
    if (['Preparing', 'Finishing', 'Reserved'].includes(status)) {
      return StationStatus.RESERVED;
    }
    if (status === 'Unavailable') return StationStatus.OFFLINE;
    return StationStatus.MAINTENANCE;
  }

  private async processCommandResponse(
    context: ConnectionContext,
    frame: Exclude<OcppFrame, OcppCall>,
  ): Promise<void> {
    const pending = this.pendingCommands.get(frame[1]);
    if (!pending || pending.chargePointId !== context.chargePointId) {
      this.log('warn', 'ocpp.response.unmatched', context, {
        correlationId: frame[1],
        resultType: frame[0],
      });
      return;
    }
    this.pendingCommands.delete(frame[1]);
    clearTimeout(pending.timer);
    const response =
      frame[0] === 3 ? frame[2] : { errorCode: frame[2], result: 'CALLERROR' };
    await this.prisma.ocppMessage.update({
      data: { response: response as Prisma.InputJsonValue },
      where: {
        chargePointId_direction_uniqueId: {
          chargePointId: context.chargePointId,
          direction: OcppMessageDirection.CSMS_TO_CHARGE_POINT,
          uniqueId: frame[1],
        },
      },
    });
    if (frame[0] === 3) {
      pending.resolve(frame[2]);
    } else {
      pending.reject(new Error(pending.action + ' returned CALLERROR ' + frame[2] + '.'));
    }
  }

  private async sendCall(
    identity: string,
    action: string,
    payload: OcppJsonObject,
  ): Promise<OcppJsonObject> {
    const connection = this.connections.get(identity);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Charge point is offline.');
    }
    const uniqueId = randomUUID();
    await this.prisma.ocppMessage.create({
      data: {
        action,
        chargePointId: connection.context.chargePointId,
        correlationId: uniqueId,
        direction: OcppMessageDirection.CSMS_TO_CHARGE_POINT,
        uniqueId,
      },
    });
    return new Promise<OcppJsonObject>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(uniqueId);
        reject(new Error(action + ' timed out.'));
      }, environment.ocppCommandTimeoutMs);
      this.pendingCommands.set(uniqueId, {
        action,
        chargePointId: connection.context.chargePointId,
        reject,
        resolve,
        timer,
      });
      connection.socket.send(
        serializeOcppFrame([2, uniqueId, action, payload]),
        (error) => {
          if (!error) return;
          clearTimeout(timer);
          this.pendingCommands.delete(uniqueId);
          reject(new Error(action + ' could not be sent.'));
        },
      );
      this.log('log', 'ocpp.command.sent', connection.context, {
        action,
        correlationId: uniqueId,
      });
    });
  }

  private sendFrame(socket: WebSocket, frame: OcppFrame): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(serializeOcppFrame(frame));
    }
  }
  private async waitForStart(sessionId: string): Promise<OcppStartResult> {
    return this.waitForValue(
      this.pendingStarts,
      sessionId,
      async () => {
        const transaction = await this.prisma.ocppTransaction.findUnique({
          where: { chargingSessionId: sessionId },
        });
        return transaction?.status === OcppTransactionStatus.ACTIVE && transaction.meterStartWh !== null
          ? { meterStartWh: transaction.meterStartWh, powerKw: 0 }
          : null;
      },
      'StartTransaction timed out.',
    );
  }

  private async waitForStop(sessionId: string): Promise<bigint> {
    return this.waitForValue(
      this.pendingStops,
      sessionId,
      async () => {
        const transaction = await this.prisma.ocppTransaction.findUnique({
          where: { chargingSessionId: sessionId },
        });
        return transaction?.status === OcppTransactionStatus.COMPLETED && transaction.meterStopWh !== null
          ? transaction.meterStopWh
          : null;
      },
      'StopTransaction timed out.',
    );
  }

  private async waitForValue<T>(
    store: Map<string, PendingValue<T>>,
    key: string,
    currentValue: () => Promise<T | null>,
    timeoutMessage: string,
  ): Promise<T> {
    const current = await currentValue();
    if (current !== null) return current;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        store.delete(key);
        reject(new Error(timeoutMessage));
      }, environment.ocppCommandTimeoutMs);
      store.set(key, { reject, resolve, timer });
      void currentValue().then((value) => {
        if (value === null) return;
        const pending = store.get(key);
        if (!pending) return;
        clearTimeout(pending.timer);
        store.delete(key);
        pending.resolve(value);
      });
    });
  }

  private resolveStart(sessionId: string, result: OcppStartResult): void {
    const pending = this.pendingStarts.get(sessionId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingStarts.delete(sessionId);
    pending.resolve(result);
  }

  private resolveStop(sessionId: string, meterStopWh: bigint): void {
    const pending = this.pendingStops.get(sessionId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingStops.delete(sessionId);
    pending.resolve(meterStopWh);
  }

  private async handleDisconnect(
    context: ConnectionContext,
    socket: WebSocket,
  ): Promise<void> {
    if (this.connections.get(context.identity)?.socket !== socket) return;
    this.connections.delete(context.identity);
    await this.prisma.chargePoint.update({
      data: {
        connectionStatus: ChargePointConnectionStatus.DISCONNECTED,
        lastSeenAt: new Date(),
        status: StationStatus.OFFLINE,
        version: { increment: 1 },
      },
      where: { id: context.chargePointId },
    });
    await this.prisma.connector.updateMany({
      data: { status: ConnectorStatus.OFFLINE, version: { increment: 1 } },
      where: { evse: { chargePointId: context.chargePointId } },
    });
    const recoverable = await this.prisma.ocppTransaction.findMany({
      where: {
        chargePointId: context.chargePointId,
        status: { in: [OcppTransactionStatus.ACTIVE, OcppTransactionStatus.STOPPING] },
      },
    });
    for (const transaction of recoverable) {
      await this.events.publish(
        {
          occurredAt: new Date().toISOString(),
          reason: 'OCPP charge point disconnected; session is recoverable.',
          recoverable: true,
          sessionId: transaction.chargingSessionId,
          type: 'DISCONNECTED',
        },
        randomUUID(),
      );
    }
    this.log('log', 'ocpp.connection.closed', context, {
      recoverableSessions: recoverable.length,
    });
  }

  private checkIdleConnections(): void {
    const now = Date.now();
    for (const { context, socket } of this.connections.values()) {
      if (now - context.lastActivityAt > environment.ocppIdleTimeoutMs) {
        this.log('warn', 'ocpp.connection.idle_timeout', context);
        socket.terminate();
        continue;
      }
      if (!context.alive) {
        socket.terminate();
        continue;
      }
      context.alive = false;
      socket.ping();
    }
  }

  private async touch(context: ConnectionContext): Promise<void> {
    context.lastActivityAt = Date.now();
    await this.prisma.chargePoint.update({
      data: { lastSeenAt: new Date(), version: { increment: 1 } },
      where: { id: context.chargePointId },
    });
  }

  private async loadOcppConnector(connectorId: string) {
    const connector = await this.prisma.connector.findFirst({
      include: { evse: { include: { chargePoint: true } } },
      where: {
        deletedAt: null,
        id: connectorId,
        evse: {
          deletedAt: null,
          chargePoint: {
            deletedAt: null,
            ocppEnabled: true,
            protocol: ChargerProtocol.OCPP16,
          },
        },
      },
    });
    if (!connector) {
      throw new ServiceUnavailableException({
        code: 'OCPP_CONNECTOR_NOT_FOUND',
        message: 'OCPP connector was not found.',
      });
    }
    return connector;
  }

  private async markTransactionFailed(
    sessionId: string,
    error: unknown,
  ): Promise<void> {
    await this.prisma.ocppTransaction.updateMany({
      data: {
        failureReason: (error instanceof Error ? error.message : 'OCPP command failed.').slice(0, 500),
        status: OcppTransactionStatus.FAILED,
        version: { increment: 1 },
      },
      where: {
        chargingSessionId: sessionId,
        status: {
          in: [OcppTransactionStatus.REMOTE_START_PENDING, OcppTransactionStatus.STOPPING],
        },
      },
    });
  }

  private log(
    level: 'log' | 'warn' | 'error',
    event: string,
    context?: ConnectionContext,
    details: Record<string, unknown> = {},
  ): void {
    const entry = JSON.stringify({
      event,
      chargePointIdentity: context?.identity,
      ...details,
    });
    this.logger[level](entry);
  }
}