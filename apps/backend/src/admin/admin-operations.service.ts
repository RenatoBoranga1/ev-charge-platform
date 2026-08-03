import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  permissionsByRole,
  supportedRemoteCommandTypes,
  type AdminRole,
} from '@solis/admin-contracts';
import {
  ChargingSessionStatus,
  ConnectorStatus,
  PaymentReconciliationStatus,
  Prisma,
  RemoteCommandStatus,
  StationStatus,
  TariffPublicationStatus,
} from '@solis/database';

import type { AuthUser } from '../auth/auth-user';
import { AuthService } from '../auth/auth.service';
import { ChargingService } from '../charging/charging.service';
import { PrismaService } from '../database/prisma.service';
import { DomainEventPublisher } from '../outbox/domain-event-publisher';
import { PaymentReconciliationService } from '../payments/reconciliation/payment-reconciliation.service';
import { RefundService } from '../payments/refunds/refund.service';
import type { AdminActor } from './access/admin-access';
import { AdminAuditService } from './audit/admin-audit.service';
import type {
  AdminListQueryDto,
  AssignOperatorRolesDto,
  ConnectorStatusDto,
  CreateStationDto,
  CreateTariffDto,
  DriverActionDto,
  InviteOperatorDto,
  RefundPaymentDto,
  RemoteCommandDto,
  UpdateStationDto,
} from './dto/admin.dto';

interface RequestContext {
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertRoleAssignmentAllowed(
  actor: AdminActor,
  roles: readonly AdminRole[],
): void {
  const requestedPermissions = new Set(
    roles.flatMap((role) => permissionsByRole[role]),
  );
  if (
    [...requestedPermissions].some(
      (permission) => !actor.permissions.includes(permission),
    )
  ) {
    throw new ForbiddenException(
      'Você não pode atribuir um papel com permissões superiores às suas.',
    );
  }
}

function toJsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as T;
  if (value instanceof Date) return value.toISOString() as T;
  if (Prisma.Decimal.isDecimal(value)) return value.toString() as T;
  if (Array.isArray(value)) return value.map(toJsonSafe) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)]),
    ) as T;
  }
  return value;
}

function cursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; nextCursor: string | null } {
  const hasNext = rows.length > limit;
  const data = toJsonSafe(hasNext ? rows.slice(0, limit) : rows);
  return {
    data,
    nextCursor: hasNext ? (data.at(-1)?.id ?? null) : null,
  };
}

const adminPaymentSelect = {
  amountMinor: true,
  authorizedAmountMinor: true,
  capturedAmountMinor: true,
  chargingSessionId: true,
  createdAt: true,
  currency: true,
  expiresAt: true,
  id: true,
  idempotencyKey: true,
  provider: true,
  providerReference: true,
  refundedAmountMinor: true,
  refunds: {
    select: {
      amountMinor: true,
      completedAt: true,
      createdAt: true,
      currency: true,
      id: true,
      reason: true,
      status: true,
    },
  },
  status: true,
  type: true,
  updatedAt: true,
  user: { select: { email: true, id: true, name: true } },
  version: true,
} satisfies Prisma.PaymentIntentSelect;

type AdminPayment = Prisma.PaymentIntentGetPayload<{
  select: typeof adminPaymentSelect;
}>;

function maskExternalReference(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 6) return '***';
  return value.slice(0, 3) + '…' + value.slice(-3);
}

function serializeAdminPayment(row: AdminPayment) {
  return {
    ...row,
    amountMinor: row.amountMinor.toString(),
    authorizedAmountMinor: row.authorizedAmountMinor.toString(),
    capturedAmountMinor: row.capturedAmountMinor.toString(),
    providerReference: maskExternalReference(row.providerReference),
    refundedAmountMinor: row.refundedAmountMinor.toString(),
    refunds: row.refunds.map((refund) => ({
      ...refund,
      amountMinor: refund.amountMinor.toString(),
    })),
  };
}

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charging: ChargingService,
    private readonly refunds: RefundService,
    private readonly reconciliation: PaymentReconciliationService,
    private readonly auth: AuthService,
    private readonly audit: AdminAuditService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async dashboard(tenantId: string) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [
      stations,
      connectedChargePoints,
      activeSessions,
      completedSessions,
      revenue,
      reconciliationIssues,
      failedCommands,
      drivers,
    ] = await Promise.all([
      this.prisma.station.count({ where: { deletedAt: null, tenantId } }),
      this.prisma.chargePoint.count({
        where: {
          connectionStatus: 'CONNECTED',
          deletedAt: null,
          station: { tenantId },
        },
      }),
      this.prisma.chargingSession.count({
        where: {
          deletedAt: null,
          station: { tenantId },
          status: {
            in: [
              'PENDING',
              'AUTHORIZED',
              'STARTING',
              'CHARGING',
              'STOPPING',
            ],
          },
        },
      }),
      this.prisma.chargingSession.count({
        where: {
          completedAt: { gte: monthStart },
          deletedAt: null,
          station: { tenantId },
          status: 'COMPLETED',
        },
      }),
      this.prisma.chargingSession.aggregate({
        _sum: { totalAmount: true },
        where: {
          completedAt: { gte: monthStart },
          deletedAt: null,
          station: { tenantId },
          status: 'COMPLETED',
        },
      }),
      this.prisma.paymentReconciliation.count({
        where: {
          status: { not: PaymentReconciliationStatus.MATCHED },
          tenantId,
        },
      }),
      this.prisma.remoteCommand.count({
        where: {
          status: { in: ['FAILED', 'REJECTED', 'TIMED_OUT'] },
          tenantId,
        },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, role: 'DRIVER', tenantId },
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        activeSessions,
        completedSessionsThisMonth: completedSessions,
        connectedChargePoints,
        drivers,
        failedCommands,
        reconciliationIssues,
        revenueThisMonth: (revenue._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
        stations,
      },
    };
  }

  async map(tenantId: string) {
    const stations = await this.prisma.station.findMany({
      include: {
        chargePoints: {
          include: {
            evses: { include: { connectors: true } },
          },
          where: { deletedAt: null },
        },
      },
      orderBy: { name: 'asc' },
      where: { deletedAt: null, tenantId },
    });
    return stations.map((station) => {
      const connectors = station.chargePoints.flatMap((chargePoint) =>
        chargePoint.evses.flatMap((evse) => evse.connectors),
      );
      return {
        availableConnectors: connectors.filter(
          ({ status }) => status === ConnectorStatus.AVAILABLE,
        ).length,
        id: station.id,
        latitude: Number(station.latitude),
        longitude: Number(station.longitude),
        name: station.name,
        status: station.status,
        totalConnectors: connectors.length,
      };
    });
  }

  async listStations(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.station.findMany({
      include: {
        _count: { select: { chargePoints: true, chargingSessions: true } },
        operator: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        deletedAt: null,
        tenantId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { city: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.status ? { status: query.status as StationStatus } : {}),
      },
    });
    return cursorPage(rows, query.limit);
  }

  async getStation(tenantId: string, id: string) {
    const station = await this.prisma.station.findFirst({
      select: {
        address: true,
        chargePoints: {
          select: {
            connectionStatus: true,
            evses: {
              select: {
                connectors: {
                  select: {
                    code: true,
                    currentType: true,
                    id: true,
                    maximumPowerKw: true,
                    plugType: true,
                    status: true,
                  },
                },
                id: true,
                status: true,
                uid: true,
              },
            },
            externalCode: true,
            id: true,
            lastSeenAt: true,
            protocol: true,
            status: true,
          },
        },
        city: true,
        id: true,
        latitude: true,
        longitude: true,
        name: true,
        operator: { select: { id: true, name: true } },
        state: true,
        status: true,
        tariffs: {
          orderBy: { createdAt: 'desc' },
          select: {
            currency: true,
            id: true,
            name: true,
            pricePerKwh: true,
            publicationStatus: true,
            validFrom: true,
            validUntil: true,
          },
        },
        version: true,
      },
      where: { deletedAt: null, id, tenantId },
    });
    if (!station) throw new NotFoundException('Estação não encontrada.');
    return station;
  }

  async createStation(
    tenantId: string,
    userId: string,
    input: CreateStationDto,
    context: RequestContext,
  ) {
    const operator = await this.prisma.operator.findFirst({
      where: { deletedAt: null, id: input.operatorId, tenantId },
    });
    if (!operator) throw new NotFoundException('Operador não encontrado.');
    return this.prisma.$transaction(async (tx) => {
      const station = await tx.station.create({
        data: {
          address: input.address.trim(),
          city: input.city.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          name: input.name.trim(),
          operatorId: operator.id,
          postalCode: input.postalCode?.trim(),
          state: input.state.trim(),
          tenantId,
        },
      });
      await tx.$executeRaw(Prisma.sql`
        UPDATE stations SET location =
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
        WHERE id = ${station.id}::uuid
      `);
      await this.audit.record(
        {
          action: 'STATION_CREATED',
          after: station,
          correlationId: context.correlationId,
          entityId: station.id,
          entityType: 'Station',
          ipAddress: context.ipAddress,
          tenantId,
          userAgent: context.userAgent,
          userId,
        },
        tx,
      );
      await this.outbox.publish(
        {
          aggregateId: station.id,
          aggregateType: 'Station',
          eventType: 'StationCreated',
          payload: { name: station.name, status: station.status },
          tenantId,
        },
        tx,
      );
      return station;
    });
  }

  async updateStation(
    tenantId: string,
    userId: string,
    id: string,
    input: UpdateStationDto,
    context: RequestContext,
  ) {
    const current = await this.prisma.station.findFirst({
      where: { deletedAt: null, id, tenantId },
    });
    if (!current) throw new NotFoundException('Estação não encontrada.');
    const result = await this.prisma.station.updateMany({
      data: {
        address: input.address?.trim(),
        city: input.city?.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name?.trim(),
        status: input.status,
        version: { increment: 1 },
      },
      where: { id, tenantId, version: input.version },
    });
    if (result.count !== 1) {
      throw new ConflictException({
        code: 'OPTIMISTIC_LOCK_CONFLICT',
        message: 'A estação foi alterada por outro operador.',
      });
    }
    const updated = await this.prisma.station.findUniqueOrThrow({ where: { id } });
    if (input.latitude !== undefined || input.longitude !== undefined) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE stations SET location =
          ST_SetSRID(ST_MakePoint(${Number(updated.longitude)}, ${Number(updated.latitude)}), 4326)::geography
        WHERE id = ${id}::uuid
      `);
    }
    await this.audit.record({
      action: 'STATION_UPDATED',
      after: updated,
      before: current,
      correlationId: context.correlationId,
      entityId: id,
      entityType: 'Station',
      tenantId,
      userId,
    });
    return updated;
  }

  async archiveStation(
    tenantId: string,
    userId: string,
    id: string,
    reason: string,
    context: RequestContext,
  ) {
    const current = await this.prisma.station.findFirst({
      where: { deletedAt: null, id, tenantId },
    });
    if (!current) throw new NotFoundException('Estação não encontrada.');
    const archived = await this.prisma.station.update({
      data: {
        deletedAt: new Date(),
        status: StationStatus.OFFLINE,
        version: { increment: 1 },
      },
      where: { id },
    });
    await this.audit.record({
      action: 'STATION_ARCHIVED',
      after: archived,
      before: current,
      correlationId: context.correlationId,
      entityId: id,
      entityType: 'Station',
      justification: reason,
      tenantId,
      userId,
    });
    return archived;
  }

  async listChargePoints(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.chargePoint.findMany({
      select: {
        connectionStatus: true,
        evses: {
          select: {
            connectors: {
              select: {
                code: true,
                currentType: true,
                id: true,
                maximumPowerKw: true,
                plugType: true,
                status: true,
              },
            },
            id: true,
            status: true,
            uid: true,
          },
        },
        externalCode: true,
        id: true,
        lastSeenAt: true,
        name: true,
        protocol: true,
        station: { select: { id: true, name: true } },
        status: true,
      },
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        deletedAt: null,
        station: { deletedAt: null, tenantId },
        ...(query.search
          ? {
              OR: [
                { externalCode: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
    return cursorPage(rows, query.limit);
  }

  async updateConnectorStatus(
    tenantId: string,
    userId: string,
    id: string,
    input: ConnectorStatusDto,
    context: RequestContext,
  ) {
    const connector = await this.prisma.connector.findFirst({
      include: { evse: { include: { chargePoint: { include: { station: true } } } } },
      where: { deletedAt: null, id, evse: { chargePoint: { station: { tenantId } } } },
    });
    if (!connector) throw new NotFoundException('Conector não encontrado.');
    const changed = await this.prisma.connector.updateMany({
      data: { status: input.status, version: { increment: 1 } },
      where: { id, version: input.version },
    });
    if (changed.count !== 1) {
      throw new ConflictException('O conector foi alterado por outro operador.');
    }
    const updated = await this.prisma.connector.findUniqueOrThrow({ where: { id } });
    await this.audit.record({
      action: 'CONNECTOR_STATUS_CHANGED',
      after: updated,
      before: connector,
      correlationId: context.correlationId,
      entityId: id,
      entityType: 'Connector',
      tenantId,
      userId,
    });
    return updated;
  }

  async listTariffs(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.tariff.findMany({
      include: { station: { select: { id: true, name: true, tenantId: true } } },
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        deletedAt: null,
        station: { tenantId },
        ...(query.status
          ? { publicationStatus: query.status as TariffPublicationStatus }
          : {}),
      },
    });
    return cursorPage(rows, query.limit);
  }

  async createTariff(
    tenantId: string,
    userId: string,
    input: CreateTariffDto,
    context: RequestContext,
  ) {
    const station = await this.prisma.station.findFirst({
      where: { deletedAt: null, id: input.stationId, tenantId },
    });
    if (!station) throw new NotFoundException('Estação não encontrada.');
    const tariff = await this.prisma.tariff.create({
      data: {
        activationFee: input.activationFee,
        currency: input.currency.toUpperCase(),
        name: input.name.trim(),
        operatorId: station.operatorId,
        parkingFeeHour: input.parkingFeeHour,
        pricePerKwh: input.pricePerKwh,
        publicationStatus: 'DRAFT',
        publishedAt: null,
        stationId: station.id,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
      },
    });
    await this.audit.record({
      action: 'TARIFF_DRAFT_CREATED',
      after: tariff,
      correlationId: context.correlationId,
      entityId: tariff.id,
      entityType: 'Tariff',
      tenantId,
      userId,
    });
    return tariff;
  }

  async publishTariff(
    tenantId: string,
    userId: string,
    id: string,
    context: RequestContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const tariff = await tx.tariff.findFirst({
        include: { station: true, versions: true },
        where: { deletedAt: null, id, station: { tenantId } },
      });
      if (!tariff) throw new NotFoundException('Tarifa não encontrada.');
      if (tariff.publicationStatus === TariffPublicationStatus.PUBLISHED) {
        return tariff;
      }
      if (tariff.publicationStatus !== TariffPublicationStatus.DRAFT) {
        throw new ConflictException('Somente uma tarifa em rascunho pode ser publicada.');
      }
      const publishedAt = new Date();
      const updated = await tx.tariff.update({
        data: {
          publicationStatus: TariffPublicationStatus.PUBLISHED,
          publishedAt,
          version: { increment: 1 },
        },
        where: { id },
      });
      await tx.tariffVersion.create({
        data: {
          createdByUserId: userId,
          effectiveAt: tariff.validFrom,
          publishedAt,
          snapshot: {
            activationFee: tariff.activationFee.toString(),
            currency: tariff.currency,
            name: tariff.name,
            parkingFeeHour: tariff.parkingFeeHour.toString(),
            pricePerKwh: tariff.pricePerKwh.toString(),
            validFrom: tariff.validFrom.toISOString(),
            validUntil: tariff.validUntil?.toISOString() ?? null,
          },
          status: TariffPublicationStatus.PUBLISHED,
          tariffId: tariff.id,
          tenantId,
          versionNumber: tariff.versions.length + 1,
        },
      });
      await this.audit.record(
        {
          action: 'TARIFF_PUBLISHED',
          after: updated,
          before: tariff,
          correlationId: context.correlationId,
          entityId: id,
          entityType: 'Tariff',
          tenantId,
          userId,
        },
        tx,
      );
      return updated;
    });
  }

  async archiveTariff(
    tenantId: string,
    userId: string,
    id: string,
    reason: string,
    context: RequestContext,
  ) {
    const tariff = await this.prisma.tariff.findFirst({
      where: { deletedAt: null, id, station: { tenantId } },
    });
    if (!tariff) throw new NotFoundException('Tarifa não encontrada.');
    const archived = await this.prisma.tariff.update({
      data: {
        archivedAt: new Date(),
        publicationStatus: 'ARCHIVED',
        validUntil: tariff.validUntil ?? new Date(),
        version: { increment: 1 },
      },
      where: { id },
    });
    await this.audit.record({
      action: 'TARIFF_ARCHIVED',
      after: archived,
      before: tariff,
      correlationId: context.correlationId,
      entityId: id,
      entityType: 'Tariff',
      justification: reason,
      tenantId,
      userId,
    });
    return archived;
  }

  async listSessions(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.chargingSession.findMany({
      include: {
        connector: { select: { code: true } },
        station: { select: { name: true } },
        user: { select: { email: true, name: true } },
        vehicle: { select: { brand: true, model: true } },
      },
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        deletedAt: null,
        station: { tenantId },
        ...(query.status
          ? { status: query.status as ChargingSessionStatus }
          : {}),
      },
    });
    return cursorPage(rows, query.limit);
  }

  async getSession(tenantId: string, id: string) {
    const session = await this.prisma.chargingSession.findFirst({
      include: {
        chargePoint: {
          select: {
            connectionStatus: true,
            externalCode: true,
            id: true,
            lastSeenAt: true,
            protocol: true,
            status: true,
          },
        },
        connector: {
          select: {
            code: true,
            currentType: true,
            id: true,
            maximumPowerKw: true,
            plugType: true,
            status: true,
          },
        },
        evse: { select: { id: true, status: true, uid: true } },
        meterValues: { orderBy: { sampledAt: 'desc' }, take: 100 },
        paymentIntents: {
          select: {
            amountMinor: true,
            capturedAmountMinor: true,
            currency: true,
            id: true,
            refundedAmountMinor: true,
            status: true,
            type: true,
          },
        },
        receipt: {
          select: {
            amountMinor: true,
            currency: true,
            id: true,
            issuedAt: true,
            receiptNumber: true,
            status: true,
          },
        },
        remoteCommands: {
          orderBy: { createdAt: 'desc' },
          select: {
            completedAt: true,
            createdAt: true,
            errorCode: true,
            id: true,
            reason: true,
            status: true,
            type: true,
          },
        },
        station: true,
        user: { select: { email: true, id: true, name: true, role: true } },
        vehicle: true,
      },
      where: { deletedAt: null, id, station: { tenantId } },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    return toJsonSafe(session);
  }

  async listCommands(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.remoteCommand.findMany({
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        tenantId,
        ...(query.status
          ? { status: query.status as RemoteCommandStatus }
          : {}),
      },
    });
    return cursorPage(rows, query.limit);
  }

  async createCommand(
    user: AuthUser,
    actor: AdminActor,
    idempotencyKey: string,
    input: RemoteCommandDto,
    context: RequestContext,
  ) {
    if (!supportedRemoteCommandTypes.includes(input.type)) {
      throw new BadRequestException({
        code: 'REMOTE_COMMAND_NOT_SUPPORTED',
        message: 'O adaptador atual suporta somente início e parada remotos.',
      });
    }
    const requiredPermission =
      input.type === 'REMOTE_START'
        ? 'sessions.remote_start'
        : 'sessions.remote_stop';
    if (!actor.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('Permissão insuficiente para o comando.');
    }
    if (!input.chargingSessionId) {
      throw new BadRequestException('chargingSessionId é obrigatório.');
    }

    const session = await this.getSession(user.tenantId, input.chargingSessionId);
    const requestHash = hashPayload(input);
    const replay = await this.prisma.remoteCommand.findUnique({
      where: {
        tenantId_idempotencyKey: {
          idempotencyKey,
          tenantId: user.tenantId,
        },
      },
    });
    if (replay) {
      if (replay.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          message: 'A chave já foi usada com outro comando.',
        });
      }
      return replay;
    }

    let command;
    try {
      command = await this.prisma.$transaction(async (tx) => {
        const created = await tx.remoteCommand.create({
          data: {
            chargePointId: input.chargePointId ?? session.chargePointId,
            chargingSessionId: session.id,
            connectorId: input.connectorId ?? session.connectorId,
            correlationId: context.correlationId,
            createdByUserId: user.sub,
            idempotencyKey,
            payload: {
              chargingSessionId: session.id,
              connectorId: input.connectorId ?? session.connectorId,
            },
            queuedAt: new Date(),
            reason: input.reason.trim(),
            requestHash,
            stationId: session.stationId,
            status: RemoteCommandStatus.QUEUED,
            tenantId: user.tenantId,
            timeoutAt: new Date(Date.now() + 30_000),
            type: input.type,
          },
        });
        await this.audit.record(
          {
            action: 'OCPP_' + input.type + '_REQUESTED',
            correlationId: context.correlationId,
            entityId: created.id,
            entityType: 'RemoteCommand',
            ipAddress: context.ipAddress,
            justification: input.reason,
            result: { status: created.status },
            tenantId: user.tenantId,
            userAgent: context.userAgent,
            userId: user.sub,
          },
          tx,
        );
        await this.outbox.publish(
          {
            aggregateId: created.id,
            aggregateType: 'RemoteCommand',
            eventType: 'RemoteCommandQueued',
            payload: {
              chargingSessionId: session.id,
              status: created.status,
              type: input.type,
            },
            tenantId: user.tenantId,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      ) {
        throw error;
      }
      const concurrentReplay = await this.prisma.remoteCommand.findUnique({
        where: {
          tenantId_idempotencyKey: {
            idempotencyKey,
            tenantId: user.tenantId,
          },
        },
      });
      if (!concurrentReplay) throw error;
      if (concurrentReplay.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          message: 'A chave já foi usada com outro comando.',
        });
      }
      return concurrentReplay;
    }

    const domainUser: AuthUser = {
      email: session.user.email,
      role: session.user.role,
      sub: session.user.id,
      tenantId: user.tenantId,
    };
    try {
      await this.prisma.remoteCommand.update({
        data: { sentAt: new Date(), status: RemoteCommandStatus.SENT },
        where: { id: command.id },
      });
      const result =
        input.type === 'REMOTE_START'
          ? await this.charging.start(
              session.id,
              domainUser,
              'admin-command:' + command.id,
              context.correlationId,
            )
          : await this.charging.stop(
              session.id,
              domainUser,
              'admin-command:' + command.id,
              context.correlationId,
            );
      return await this.prisma.$transaction(async (tx) => {
        const accepted = await tx.remoteCommand.update({
          data: {
            completedAt: new Date(),
            result: this.audit.sanitize(result) as Prisma.InputJsonValue,
            status: RemoteCommandStatus.ACCEPTED,
            version: { increment: 1 },
          },
          where: { id: command.id },
        });
        await this.audit.record(
          {
            action: 'OCPP_' + input.type,
            correlationId: context.correlationId,
            entityId: command.id,
            entityType: 'RemoteCommand',
            justification: input.reason,
            result: { status: accepted.status },
            tenantId: user.tenantId,
            userId: user.sub,
          },
          tx,
        );
        await this.outbox.publish(
          {
            aggregateId: command.id,
            aggregateType: 'RemoteCommand',
            eventType: 'RemoteCommandAccepted',
            payload: { status: accepted.status, type: input.type },
            tenantId: user.tenantId,
          },
          tx,
        );
        return accepted;
      });
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        const failed = await tx.remoteCommand.update({
          data: {
            completedAt: new Date(),
            errorCode: 'COMMAND_FAILED',
            errorMessage:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Falha no comando.',
            status: RemoteCommandStatus.FAILED,
            version: { increment: 1 },
          },
          where: { id: command.id },
        });
        await this.audit.record(
          {
            action: 'OCPP_' + input.type,
            correlationId: context.correlationId,
            entityId: command.id,
            entityType: 'RemoteCommand',
            justification: input.reason,
            outcome: 'FAILED',
            result: { status: failed.status },
            tenantId: user.tenantId,
            userId: user.sub,
          },
          tx,
        );
        await this.outbox.publish(
          {
            aggregateId: command.id,
            aggregateType: 'RemoteCommand',
            eventType: 'RemoteCommandFailed',
            payload: { status: failed.status, type: input.type },
            tenantId: user.tenantId,
          },
          tx,
        );
      });
      throw error;
    }
  }
  async listDrivers(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        blockedAt: true,
        blockedReason: true,
        createdAt: true,
        email: true,
        id: true,
        isBlocked: true,
        name: true,
        phone: true,
      },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        deletedAt: null,
        role: 'DRIVER',
        tenantId,
        ...(query.search
          ? {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
    return cursorPage(rows, query.limit);
  }

  async setDriverBlocked(
    tenantId: string,
    userId: string,
    driverId: string,
    blocked: boolean,
    input: DriverActionDto,
    context: RequestContext,
  ) {
    const driver = await this.prisma.user.findFirst({
      where: { deletedAt: null, id: driverId, role: 'DRIVER', tenantId },
    });
    if (!driver) throw new NotFoundException('Motorista não encontrado.');
    const updated = await this.prisma.user.update({
      data: {
        blockedAt: blocked ? new Date() : null,
        blockedReason: blocked ? input.reason.trim() : null,
        isBlocked: blocked,
        version: { increment: 1 },
      },
      where: { id: driver.id },
    });
    if (blocked) await this.auth.revokeAllRefreshTokens(driver.id);
    await this.audit.record({
      action: blocked ? 'DRIVER_BLOCKED' : 'DRIVER_UNBLOCKED',
      after: { isBlocked: updated.isBlocked },
      before: { isBlocked: driver.isBlocked },
      correlationId: context.correlationId,
      entityId: driver.id,
      entityType: 'User',
      justification: input.reason,
      tenantId,
      userId,
    });
    return {
      blockedAt: updated.blockedAt,
      id: updated.id,
      isBlocked: updated.isBlocked,
    };
  }

  async listPayments(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.paymentIntent.findMany({
      orderBy: { id: 'asc' },
      select: adminPaymentSelect,
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: { deletedAt: null, tenantId },
    });
    return cursorPage(rows.map(serializeAdminPayment), query.limit);
  }

  async getPayment(tenantId: string, paymentId: string) {
    const payment = await this.prisma.paymentIntent.findFirst({
      select: adminPaymentSelect,
      where: { deletedAt: null, id: paymentId, tenantId },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    return serializeAdminPayment(payment);
  }
  async refundPayment(
    admin: AuthUser,
    paymentId: string,
    idempotencyKey: string,
    input: RefundPaymentDto,
    context: RequestContext,
  ) {
    const payment = await this.prisma.paymentIntent.findFirst({
      include: { user: true },
      where: { deletedAt: null, id: paymentId, tenantId: admin.tenantId },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    const result = await this.refunds.refundCapturedPayment(
      payment.id,
      {
        email: payment.user.email,
        role: payment.user.role,
        sub: payment.user.id,
        tenantId: admin.tenantId,
      },
      idempotencyKey,
      input.reason,
      context.correlationId,
    );
    await this.audit.record({
      action: 'ADMIN_PAYMENT_REFUND',
      correlationId: context.correlationId,
      entityId: result.id,
      entityType: 'Refund',
      justification: input.reason,
      result,
      tenantId: admin.tenantId,
      userId: admin.sub,
    });
    return result;
  }

  async listReconciliation(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.paymentReconciliation.findMany({
      include: {
        paymentIntent: {
          select: {
            currency: true,
            id: true,
            provider: true,
            providerReference: true,
            status: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        tenantId,
        ...(query.status
          ? { status: query.status as PaymentReconciliationStatus }
          : {}),
      },
    });
    return cursorPage(
      rows.map((row) => ({
        ...row,
        localAmountMinor: row.localAmountMinor.toString(),
        paymentIntent: {
          ...row.paymentIntent,
          providerReference: maskExternalReference(
            row.paymentIntent.providerReference,
          ),
        },
        providerAmountMinor: row.providerAmountMinor?.toString() ?? null,
      })),
      query.limit,
    );
  }

  async reconcilePayments(user: AuthUser, context: RequestContext) {
    const result = await this.reconciliation.run(user.tenantId);
    await this.audit.record({
      action: 'PAYMENT_RECONCILIATION_TRIGGERED',
      correlationId: context.correlationId,
      entityType: 'PaymentReconciliation',
      result,
      tenantId: user.tenantId,
      userId: user.sub,
    });
    return result;
  }

  async listOperators(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.operatorMembership.findMany({
      include: { roleAssignments: true },
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: { deletedAt: null, tenantId },
    });
    return cursorPage(rows, query.limit);
  }

  async inviteOperator(
    admin: AuthUser,
    actor: AdminActor,
    input: InviteOperatorDto,
    context: RequestContext,
  ) {
    assertRoleAssignmentAllowed(actor, input.roles);


    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.operatorMembership.findUnique({
      where: { tenantId_email: { email, tenantId: admin.tenantId } },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Este operador já pertence ao tenant.');
    }
    const token = randomBytes(32).toString('base64url');
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { email, tenantId: admin.tenantId } },
    });
    const membership = await this.prisma.operatorMembership.create({
      data: {
        displayName: input.name.trim(),
        email,
        invitationExpiresAt: new Date(Date.now() + 7 * 86_400_000),
        invitationTokenHash: hashPayload(token),
        roleAssignments: {
          create: input.roles.map((role) => ({
            assignedByUserId: admin.sub,
            role,
          })),
        },
        status: user ? 'ACTIVE' : 'INVITED',
        tenantId: admin.tenantId,
        userId: user?.id,
        ...(user ? { acceptedAt: new Date() } : {}),
      },
      include: { roleAssignments: true },
    });
    await this.audit.record({
      action: 'OPERATOR_INVITED',
      after: { email, roles: input.roles, status: membership.status },
      correlationId: context.correlationId,
      entityId: membership.id,
      entityType: 'OperatorMembership',
      tenantId: admin.tenantId,
      userId: admin.sub,
    });
    return membership;
  }

  async assignRoles(
    admin: AuthUser,
    actor: AdminActor,
    membershipId: string,
    input: AssignOperatorRolesDto,
    context: RequestContext,
  ) {
    assertRoleAssignmentAllowed(actor, input.roles);


    const { before: membership, after: updated } = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.operatorMembership.findFirst({
          include: { roleAssignments: true },
          where: {
            deletedAt: null,
            id: membershipId,
            tenantId: admin.tenantId,
          },
        });
        if (!current) throw new NotFoundException('Operador não encontrado.');

        const removesTenantAdmin =
          current.roleAssignments.some(({ role }) => role === 'TENANT_ADMIN') &&
          !input.roles.includes('TENANT_ADMIN');
        if (removesTenantAdmin) {
          const otherTenantAdmins = await tx.operatorRoleAssignment.count({
            where: {
              membershipId: { not: membershipId },
              role: 'TENANT_ADMIN',
              membership: {
                is: {
                  deletedAt: null,
                  disabledAt: null,
                  status: 'ACTIVE',
                  tenantId: admin.tenantId,
                },
              },
            },
          });
          if (otherTenantAdmins === 0) {
            throw new ConflictException(
              'O tenant deve manter ao menos um administrador ativo.',
            );
          }
        }

        await tx.operatorRoleAssignment.deleteMany({ where: { membershipId } });
        await tx.operatorRoleAssignment.createMany({
          data: input.roles.map((role) => ({
            assignedByUserId: admin.sub,
            membershipId,
            role,
          })),
          skipDuplicates: true,
        });
        await tx.operatorMembership.update({
          data: { version: { increment: 1 } },
          where: { id: membershipId },
        });
        const after = await tx.operatorMembership.findUniqueOrThrow({
          include: { roleAssignments: true },
          where: { id: membershipId },
        });
        return { after, before: current };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.record({
      action: 'OPERATOR_ROLES_ASSIGNED',
      after: { roles: updated.roleAssignments.map(({ role }) => role) },
      before: { roles: membership.roleAssignments.map(({ role }) => role) },
      correlationId: context.correlationId,
      entityId: membershipId,
      entityType: 'OperatorMembership',
      tenantId: admin.tenantId,
      userId: admin.sub,
    });
    return updated;
  }
  async disableOperator(
    admin: AuthUser,
    membershipId: string,
    input: DriverActionDto,
    context: RequestContext,
  ) {

    const { before: membership, after: updated } = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.operatorMembership.findFirst({
          include: { roleAssignments: true },
          where: {
            deletedAt: null,
            id: membershipId,
            tenantId: admin.tenantId,
          },
        });
        if (!current) throw new NotFoundException('Operador não encontrado.');
        if (current.userId === admin.sub) {
          throw new ConflictException(
            'Você não pode desativar o próprio acesso.',
          );
        }

        if (
          current.roleAssignments.some(({ role }) => role === 'TENANT_ADMIN')
        ) {
          const otherTenantAdmins = await tx.operatorRoleAssignment.count({
            where: {
              membershipId: { not: membershipId },
              role: 'TENANT_ADMIN',
              membership: {
                is: {
                  deletedAt: null,
                  disabledAt: null,
                  status: 'ACTIVE',
                  tenantId: admin.tenantId,
                },
              },
            },
          });
          if (otherTenantAdmins === 0) {
            throw new ConflictException(
              'O tenant deve manter ao menos um administrador ativo.',
            );
          }
        }

        const after = await tx.operatorMembership.update({
          data: {
            disabledAt: new Date(),
            disabledReason: input.reason.trim(),
            status: 'DISABLED',
            version: { increment: 1 },
          },
          where: { id: membershipId },
        });
        return { after, before: current };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (membership.userId) await this.auth.revokeAllRefreshTokens(membership.userId);
    await this.audit.record({
      action: 'OPERATOR_DISABLED',
      after: { status: updated.status },
      before: { status: membership.status },
      correlationId: context.correlationId,
      entityId: membershipId,
      entityType: 'OperatorMembership',
      justification: input.reason,
      tenantId: admin.tenantId,
      userId: admin.sub,
    });
    return updated;
  }
  async listAudit(tenantId: string, query: AdminListQueryDto) {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { id: 'asc' },
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      where: {
        tenantId,
        ...(query.search
          ? {
              OR: [
                { action: { contains: query.search, mode: 'insensitive' } },
                { entityType: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
    return cursorPage(rows, query.limit);
  }

  async exportSessionsCsv(tenantId: string): Promise<string> {
    const sessions = await this.prisma.chargingSession.findMany({
      include: {
        connector: { select: { code: true } },
        station: { select: { name: true } },
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      where: { deletedAt: null, station: { tenantId } },
    });
    const escape = (value: unknown) => {
      let serialized = '';
      if (typeof value === 'string') serialized = value;
      else if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
      ) {
        serialized = value.toString();
      } else if (value instanceof Date) serialized = value.toISOString();
      else if (Prisma.Decimal.isDecimal(value)) serialized = value.toString();
      else if (value && typeof value === 'object') {
        serialized = JSON.stringify(value);
      }
      return `"${serialized.replaceAll('"', '""')}"`;
    };    return [
      ['id', 'status', 'estacao', 'conector', 'motorista', 'energia_kwh', 'valor', 'inicio', 'fim']
        .map(escape)
        .join(','),
      ...sessions.map((session) =>
        [
          session.id,
          session.status,
          session.station.name,
          session.connector.code,
          session.user.email,
          session.energyKwh.toString(),
          session.totalAmount.toString(),
          session.startedAt?.toISOString() ?? '',
          session.completedAt?.toISOString() ?? '',
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n');
  }
}
