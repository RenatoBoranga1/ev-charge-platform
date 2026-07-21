import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChargingSessionStatus,
  ConnectorStatus,
  Prisma,
} from '@solis/database';

import type { AuthUser } from '../auth/auth-user';
import { IdempotencyService } from '../common/idempotency.service';
import { environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { DomainEventPublisher } from '../outbox/domain-event-publisher';
import { StationsService } from '../stations/stations.service';
import {
  chargingSessionInclude,
  type ChargingSessionRecord,
  readTariffSnapshot,
  sessionDurationSeconds,
  toChargingSessionDto,
  toChargingSessionMetrics,
  toChargingSummaryDto,
} from './charging-session.presenter';
import { ChargingRealtimeGateway } from './charging-realtime.gateway';
import {
  assertChargingSessionTransition,
  isTerminalChargingSessionState,
} from './domain/charging-session-state-machine';
import {
  calculateChargingPrice,
  type TariffSnapshot,
} from './domain/tariff-calculator';
import type { ChargerEventDto } from './dto/charger-event.dto';
import type { CreateChargingSessionDto } from './dto/create-charging-session.dto';
import type { ValidateQrDto } from './dto/validate-qr.dto';
import { ChargerGateway } from './gateway/charger-gateway';

const activeStatuses: ChargingSessionStatus[] = [
  ChargingSessionStatus.PENDING,
  ChargingSessionStatus.AUTHORIZED,
  ChargingSessionStatus.STARTING,
  ChargingSessionStatus.CHARGING,
  ChargingSessionStatus.STOPPING,
];

@Injectable()
export class ChargingService {
  constructor(
    private readonly stations: StationsService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly outbox: DomainEventPublisher,
    private readonly chargerGateway: ChargerGateway,
    private readonly realtime: ChargingRealtimeGateway,
  ) {}

  validateQr(input: ValidateQrDto, tenantId: string) {
    if (!input.connectorId && !input.code) {
      throw new BadRequestException('Informe connectorId ou codigo manual.');
    }
    return this.stations.validateConnector(
      {
        chargePointId: input.chargePointId,
        code: input.code?.trim().toUpperCase(),
        connectorId: input.connectorId,
        evseId: input.evseId,
        stationId: input.stationId,
      },
      tenantId,
    );
  }

  async create(
    input: CreateChargingSessionDto,
    user: AuthUser,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.idempotency.execute(
      'charging:create:' + user.sub,
      idempotencyKey,
      async () => {
        try {
          const session = await this.prisma.$transaction(
            async (tx) => {
              const vehicle = await tx.vehicle.findFirst({
                where: {
                  deletedAt: null,
                  id: input.vehicleId,
                  userId: user.sub,
                },
              });
              if (!vehicle) {
                throw new NotFoundException('Veiculo nao encontrado.');
              }

              const connector = await tx.connector.findFirst({
                include: {
                  evse: {
                    include: {
                      chargePoint: {
                        include: { station: true },
                      },
                    },
                  },
                },
                where: {
                  deletedAt: null,
                  id: input.connectorId,
                  evse: {
                    deletedAt: null,
                    chargePoint: {
                      deletedAt: null,
                      station: {
                        deletedAt: null,
                        tenantId: user.tenantId,
                      },
                    },
                  },
                },
              });
              if (!connector) {
                throw new NotFoundException('Conector nao encontrado.');
              }
              if (connector.status !== ConnectorStatus.AVAILABLE) {
                throw new ConflictException({
                  code: 'CONNECTOR_UNAVAILABLE',
                  message: 'O conector esta offline, reservado ou ocupado.',
                });
              }

              const chargePoint = connector.evse.chargePoint;
              const station = chargePoint.station;
              const now = new Date();
              const tariff = await tx.tariff.findFirst({
                orderBy: { validFrom: 'desc' },
                where: {
                  deletedAt: null,
                  stationId: station.id,
                  validFrom: { lte: now },
                  OR: [{ validUntil: null }, { validUntil: { gt: now } }],
                },
              });
              if (!tariff) {
                throw new ConflictException('Tarifa ativa nao encontrada.');
              }

              const snapshot: TariffSnapshot = {
                activationFee: Number(tariff.activationFee),
                currency: tariff.currency,
                initialBatteryPercent: 30,
                parkingFeeHour: Number(tariff.parkingFeeHour),
                pricePerKwh: Number(tariff.pricePerKwh),
              };
              const reservation = await tx.connector.updateMany({
                data: {
                  status: ConnectorStatus.RESERVED,
                  version: { increment: 1 },
                },
                where: {
                  id: connector.id,
                  status: ConnectorStatus.AVAILABLE,
                  version: connector.version,
                },
              });
              if (reservation.count !== 1) {
                throw new ConflictException({
                  code: 'CONNECTOR_CONCURRENCY_CONFLICT',
                  message: 'O conector acabou de ser ocupado.',
                });
              }

              const pending = await tx.chargingSession.create({
                data: {
                  chargePointId: chargePoint.id,
                  connectorId: connector.id,
                  evseId: connector.evse.id,
                  idempotencyKey,
                  stationId: station.id,
                  status: ChargingSessionStatus.PENDING,
                  tariffId: tariff.id,
                  tariffSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                  userId: user.sub,
                  vehicleId: vehicle.id,
                },
                include: chargingSessionInclude,
              });
              await tx.auditLog.create({
                data: {
                  action: 'CHARGING_SESSION_CREATED',
                  after: { status: pending.status, version: pending.version },
                  correlationId,
                  entityId: pending.id,
                  entityType: 'ChargingSession',
                  tenantId: user.tenantId,
                  userId: user.sub,
                },
              });
              await this.outbox.publish(
                {
                  aggregateId: pending.id,
                  aggregateType: 'ChargingSession',
                  eventType: 'ChargingSessionCreated',
                  payload: {
                    connectorId: pending.connectorId,
                    status: pending.status,
                    userId: pending.userId,
                    version: pending.version,
                  },
                  tenantId: user.tenantId,
                },
                tx,
              );
              return this.transition(
                tx,
                pending,
                ChargingSessionStatus.AUTHORIZED,
                user,
                correlationId,
              );
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
          return toChargingSessionDto(session);
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === 'P2002' || error.code === 'P2034')
          ) {
            throw new ConflictException({
              code: 'ACTIVE_SESSION_EXISTS',
              message: 'Ja existe uma sessao ativa neste conector.',
            });
          }
          throw error;
        }
      },
    );
  }

  async getActive(user: AuthUser) {
    const session = await this.prisma.chargingSession.findFirst({
      include: chargingSessionInclude,
      orderBy: { createdAt: 'desc' },
      where: {
        deletedAt: null,
        status: { in: activeStatuses },
        userId: user.sub,
      },
    });
    return session ? toChargingSessionDto(session) : null;
  }

  async getById(sessionId: string, user: AuthUser) {
    return toChargingSessionDto(await this.loadSession(sessionId, user.sub));
  }

  async getMetrics(sessionId: string, user: AuthUser) {
    return toChargingSessionMetrics(
      await this.loadSession(sessionId, user.sub),
    );
  }

  async start(
    sessionId: string,
    user: AuthUser,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.idempotency.execute(
      'charging:start:' + user.sub + ':' + sessionId,
      idempotencyKey,
      async () => {
        const prepared = await this.prisma.$transaction(async (tx) => {
          const session = await tx.chargingSession.findFirst({
            include: chargingSessionInclude,
            where: { deletedAt: null, id: sessionId, userId: user.sub },
          });
          if (!session) throw new NotFoundException('Sessao nao encontrada.');
          if (
            session.status === ChargingSessionStatus.STARTING ||
            session.status === ChargingSessionStatus.CHARGING
          ) {
            return { invokeGateway: false, session };
          }
          if (session.status !== ChargingSessionStatus.AUTHORIZED) {
            throw new ConflictException({
              code: 'INVALID_SESSION_STATE',
              message: 'A sessao nao pode ser iniciada no estado atual.',
            });
          }

          const connector = await tx.connector.findUnique({
            where: { id: session.connectorId },
          });
          if (
            !connector ||
            connector.status === ConnectorStatus.OFFLINE ||
            connector.status === ConnectorStatus.OCCUPIED ||
            connector.status === ConnectorStatus.MAINTENANCE
          ) {
            throw new ConflictException({
              code: 'CONNECTOR_UNAVAILABLE',
              message: 'O conector esta offline ou ocupado.',
            });
          }

          const starting = await this.transition(
            tx,
            session,
            ChargingSessionStatus.STARTING,
            user,
            correlationId,
          );
          return { invokeGateway: true, session: starting };
        });

        if (!prepared.invokeGateway) {
          return toChargingSessionDto(prepared.session);
        }

        try {
          await this.chargerGateway.registerConnector({
            connectorId: prepared.session.connectorId,
            maximumPowerKw: Number(
              prepared.session.connector.maximumPowerKw,
            ),
            status: 'AVAILABLE',
          });
          const accepted = await this.chargerGateway.start({
            callbackUrl:
              environment.backendInternalUrl + '/internal/charger-events',
            connectorId: prepared.session.connectorId,
            maximumPowerKw: Number(
              prepared.session.connector.maximumPowerKw,
            ),
            scenario: environment.simulatorScenario,
            sessionId: prepared.session.id,
          });

          const charging = await this.prisma.$transaction(async (tx) => {
            const current = await tx.chargingSession.findUnique({
              include: chargingSessionInclude,
              where: { id: prepared.session.id },
            });
            if (!current) throw new NotFoundException('Sessao nao encontrada.');
            if (current.status === ChargingSessionStatus.CHARGING) return current;
            if (current.status !== ChargingSessionStatus.STARTING) {
              throw new ConflictException('A sessao mudou durante o start.');
            }

            await tx.connector.update({
              data: {
                status: ConnectorStatus.OCCUPIED,
                version: { increment: 1 },
              },
              where: { id: current.connectorId },
            });
            return this.transition(
              tx,
              current,
              ChargingSessionStatus.CHARGING,
              user,
              correlationId,
              {
                currentPowerKw: accepted.powerKw,
                meterStartWh: accepted.meterStartWh,
                startedAt: new Date(),
              },
            );
          });
          this.realtime.publish(toChargingSessionMetrics(charging));
          return toChargingSessionDto(charging);
        } catch (error) {
          await this.failSession(
            prepared.session.id,
            user,
            correlationId,
            error instanceof Error ? error.message : 'Falha ao iniciar carregador.',
          );
          throw error;
        }
      },
    );
  }

  async stop(
    sessionId: string,
    user: AuthUser,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.idempotency.execute(
      'charging:stop:' + user.sub + ':' + sessionId,
      idempotencyKey,
      async () => {
        const prepared = await this.prisma.$transaction(async (tx) => {
          const session = await tx.chargingSession.findFirst({
            include: chargingSessionInclude,
            where: { deletedAt: null, id: sessionId, userId: user.sub },
          });
          if (!session) throw new NotFoundException('Sessao nao encontrada.');
          if (
            session.status === ChargingSessionStatus.COMPLETED ||
            session.status === ChargingSessionStatus.STOPPING
          ) {
            return { invokeGateway: false, session };
          }
          if (session.status !== ChargingSessionStatus.CHARGING) {
            throw new ConflictException({
              code: 'INVALID_SESSION_STATE',
              message: 'A sessao nao pode ser encerrada no estado atual.',
            });
          }
          const stopping = await this.transition(
            tx,
            session,
            ChargingSessionStatus.STOPPING,
            user,
            correlationId,
          );
          return { invokeGateway: true, session: stopping };
        });

        if (!prepared.invokeGateway) {
          return toChargingSummaryDto(prepared.session);
        }

        try {
          const stopped = await this.chargerGateway.stop(prepared.session.id);
          const completed = await this.completeSession(
            prepared.session.id,
            user,
            correlationId,
            stopped.meterStopWh,
          );
          this.realtime.publish(toChargingSessionMetrics(completed));
          return toChargingSummaryDto(completed);
        } catch (error) {
          await this.failSession(
            prepared.session.id,
            user,
            correlationId,
            error instanceof Error ? error.message : 'Falha ao parar carregador.',
          );
          throw error;
        }
      },
    );
  }

  async handleChargerEvent(
    input: ChargerEventDto,
    correlationId: string,
  ): Promise<void> {
    const session = await this.prisma.chargingSession.findUnique({
      include: chargingSessionInclude,
      where: { id: input.sessionId },
    });
    if (!session) throw new NotFoundException('Sessao nao encontrada.');

    const user: AuthUser = {
      email: 'charger-simulator@internal',
      role: 'SYSTEM',
      sub: session.userId,
      tenantId: session.station.tenantId,
    };

    if (input.type === 'METER_VALUE') {
      const updated = await this.recordMeterValue(session, input);
      if (updated) this.realtime.publish(toChargingSessionMetrics(updated));
      return;
    }

    await this.failSession(
      session.id,
      user,
      correlationId,
      input.reason ??
        (input.type === 'DISCONNECTED'
          ? 'Charger disconnected.'
          : 'Simulated charger failure.'),
      input.type === 'DISCONNECTED',
    );
  }

  assertSimulatorSecret(secret: string | undefined): void {
    if (secret !== environment.simulatorSecret) {
      throw new ForbiddenException('Invalid simulator secret.');
    }
  }

  private async recordMeterValue(
    knownSession: ChargingSessionRecord,
    input: ChargerEventDto,
  ): Promise<ChargingSessionRecord | null> {
    if (knownSession.status !== ChargingSessionStatus.CHARGING) return null;
    if (!input.meterWh || input.powerKw === undefined) {
      throw new BadRequestException('Meter event is incomplete.');
    }

    let meterWh: bigint;
    try {
      meterWh = BigInt(input.meterWh);
    } catch {
      throw new BadRequestException('Invalid meter value.');
    }
    const startWh = knownSession.meterStartWh ?? meterWh;
    if (meterWh < startWh) {
      throw new BadRequestException('Meter value cannot move backwards.');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.chargingSession.findUnique({
        include: chargingSessionInclude,
        where: { id: knownSession.id },
      });
      if (!current || current.status !== ChargingSessionStatus.CHARGING) {
        return null;
      }
      const sampledAt = new Date(input.occurredAt);
      const energyKwh = Number(
        meterWh - (current.meterStartWh ?? meterWh),
      ) / 1000;
      const durationSeconds = sessionDurationSeconds(current, sampledAt);
      const tariff = readTariffSnapshot(current.tariffSnapshot);
      const price = calculateChargingPrice(
        energyKwh,
        durationSeconds,
        tariff,
      );

      await tx.meterValue.upsert({
        create: {
          batteryPercent: input.batteryPercent,
          chargingSessionId: current.id,
          energyKwh,
          meterWh,
          powerKw: input.powerKw,
          sampledAt,
        },
        update: {
          batteryPercent: input.batteryPercent,
          energyKwh,
          meterWh,
          powerKw: input.powerKw,
        },
        where: {
          chargingSessionId_sampledAt: {
            chargingSessionId: current.id,
            sampledAt,
          },
        },
      });

      const update = await tx.chargingSession.updateMany({
        data: {
          currentPowerKw: input.powerKw,
          energyKwh,
          estimatedCost: price.totalAmount,
          meterStopWh: meterWh,
          totalAmount: price.totalAmount,
          version: { increment: 1 },
        },
        where: {
          id: current.id,
          status: ChargingSessionStatus.CHARGING,
          version: current.version,
        },
      });
      if (update.count !== 1) {
        throw new ConflictException('Meter update concurrency conflict.');
      }
      return tx.chargingSession.findUniqueOrThrow({
        include: chargingSessionInclude,
        where: { id: current.id },
      });
    });
  }

  private async completeSession(
    sessionId: string,
    user: AuthUser,
    correlationId: string,
    meterStopWh: bigint,
  ): Promise<ChargingSessionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.chargingSession.findUnique({
        include: chargingSessionInclude,
        where: { id: sessionId },
      });
      if (!current) throw new NotFoundException('Sessao nao encontrada.');
      if (current.status === ChargingSessionStatus.COMPLETED) return current;
      if (current.status !== ChargingSessionStatus.STOPPING) {
        throw new ConflictException('A sessao mudou durante o stop.');
      }

      const now = new Date();
      const meterStartWh = current.meterStartWh ?? meterStopWh;
      const normalizedStop =
        meterStopWh < meterStartWh ? meterStartWh : meterStopWh;
      const energyKwh = Number(normalizedStop - meterStartWh) / 1000;
      const tariff = readTariffSnapshot(current.tariffSnapshot);
      const price = calculateChargingPrice(
        energyKwh,
        sessionDurationSeconds(current, now),
        tariff,
      );

      await tx.connector.update({
        data: {
          status: ConnectorStatus.AVAILABLE,
          version: { increment: 1 },
        },
        where: { id: current.connectorId },
      });
      const completed = await this.transition(
        tx,
        current,
        ChargingSessionStatus.COMPLETED,
        user,
        correlationId,
        {
          completedAt: now,
          currentPowerKw: 0,
          energyKwh,
          estimatedCost: price.totalAmount,
          meterStopWh: normalizedStop,
          stoppedAt: now,
          totalAmount: price.totalAmount,
        },
      );
      await tx.user.update({
        data: {
          avoidedCo2Kg: { increment: energyKwh * 0.0817 },
          totalEnergyKwh: { increment: energyKwh },
          version: { increment: 1 },
        },
        where: { id: current.userId },
      });
      return completed;
    });
  }

  private async failSession(
    sessionId: string,
    user: AuthUser,
    correlationId: string,
    reason: string,
    disconnected = false,
  ): Promise<ChargingSessionRecord> {
    const failed = await this.prisma.$transaction(async (tx) => {
      const current = await tx.chargingSession.findUnique({
        include: chargingSessionInclude,
        where: { id: sessionId },
      });
      if (!current) throw new NotFoundException('Sessao nao encontrada.');
      if (
        isTerminalChargingSessionState(
          current.status,
        )
      ) {
        return current;
      }

      await tx.connector.update({
        data: {
          status: disconnected
            ? ConnectorStatus.OFFLINE
            : ConnectorStatus.AVAILABLE,
          version: { increment: 1 },
        },
        where: { id: current.connectorId },
      });
      return this.transition(
        tx,
        current,
        ChargingSessionStatus.FAILED,
        user,
        correlationId,
        {
          currentPowerKw: 0,
          failureReason: reason.slice(0, 500),
          stoppedAt: current.startedAt ? new Date() : null,
        },
      );
    });
    this.realtime.publish(toChargingSessionMetrics(failed));
    return failed;
  }

  private async transition(
    tx: Prisma.TransactionClient,
    current: ChargingSessionRecord,
    target: ChargingSessionStatus,
    user: AuthUser,
    correlationId: string,
    data: Prisma.ChargingSessionUpdateManyMutationInput = {},
  ): Promise<ChargingSessionRecord> {
    assertChargingSessionTransition(
      current.status,
      target,
    );
    if (current.status === target) return current;

    const update = await tx.chargingSession.updateMany({
      data: {
        ...data,
        status: target,
        version: { increment: 1 },
      },
      where: {
        id: current.id,
        status: current.status,
        version: current.version,
      },
    });
    if (update.count !== 1) {
      throw new ConflictException({
        code: 'OPTIMISTIC_LOCK_CONFLICT',
        message: 'A sessao foi alterada por outra requisicao.',
      });
    }

    const updated = await tx.chargingSession.findUniqueOrThrow({
      include: chargingSessionInclude,
      where: { id: current.id },
    });
    await tx.auditLog.create({
      data: {
        action: 'CHARGING_SESSION_STATE_CHANGED',
        after: { status: updated.status, version: updated.version },
        before: { status: current.status, version: current.version },
        correlationId,
        entityId: current.id,
        entityType: 'ChargingSession',
        tenantId: user.tenantId,
        userId: user.role === 'SYSTEM' ? null : user.sub,
      },
    });
    await this.outbox.publish(
      {
        aggregateId: current.id,
        aggregateType: 'ChargingSession',
        eventType: 'ChargingSessionStateChanged',
        payload: {
          correlationId,
          from: current.status,
          to: updated.status,
          version: updated.version,
        },
        tenantId: user.tenantId,
      },
      tx,
    );
    return updated;
  }

  private async loadSession(
    sessionId: string,
    userId: string,
  ): Promise<ChargingSessionRecord> {
    const session = await this.prisma.chargingSession.findFirst({
      include: chargingSessionInclude,
      where: { deletedAt: null, id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Sessao nao encontrada.');
    return session;
  }
}
