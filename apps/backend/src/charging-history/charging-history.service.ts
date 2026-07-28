import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@solis/database';

import type { AuthUser } from '../auth/auth-user';
import { resolveDateRange } from '../common/date-range';
import { PrismaService } from '../database/prisma.service';
import {
  ChargingHistoryRepository,
  type MeterPointRow,
} from './charging-history.repository';
import {
  type HistorySession,
  toHistoryItem,
  toSessionDetails,
  toTimelineEvent,
} from './charging-history.presenter';
import type { ChargingHistoryQueryDto } from './dto/charging-history-query.dto';

interface StateAudit {
  after: Prisma.JsonValue | null;
  createdAt: Date;
}

function statusFromAudit(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const status = (value as Record<string, unknown>).status;
  return typeof status === 'string' ? status : null;
}

@Injectable()
export class ChargingHistoryService {
  constructor(
    private readonly repository: ChargingHistoryRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthUser, query: ChargingHistoryQueryDto) {
    const period = resolveDateRange(query);
    await this.assertVehicleOwnership(query.vehicleId, user);
    const page = await this.repository.list(user, query, period);
    return {
      items: page.items.map(toHistoryItem),
      pageInfo: {
        endCursor: page.endCursor,
        hasNextPage: page.hasNextPage,
      },
    };
  }

  async getDetails(sessionId: string, user: AuthUser) {
    const session = await this.requireSession(sessionId, user);
    const aggregate = await this.prisma.meterValue.aggregate({
      _avg: { powerKw: true },
      _max: { powerKw: true },
      where: { chargingSessionId: session.id },
    });
    return toSessionDetails(session, {
      averagePowerKw:
        aggregate._avg.powerKw === null
          ? null
          : Number(aggregate._avg.powerKw.toFixed(2)),
      maximumPowerKw:
        aggregate._max.powerKw === null
          ? null
          : Number(aggregate._max.powerKw.toFixed(2)),
    });
  }

  async getTimeline(sessionId: string, user: AuthUser) {
    const session = await this.requireSession(sessionId, user);
    const [audits, firstMeter] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'asc' },
        select: { after: true, createdAt: true },
        where: {
          action: {
            in: [
              'CHARGING_SESSION_CREATED',
              'CHARGING_SESSION_STATE_CHANGED',
            ],
          },
          entityId: session.id,
          entityType: 'ChargingSession',
          tenantId: user.tenantId,
        },
      }),
      this.prisma.meterValue.findFirst({
        orderBy: { sampledAt: 'asc' },
        select: { sampledAt: true },
        where: { chargingSessionId: session.id },
      }),
    ]);
    const events = (audits as StateAudit[]).flatMap((audit) => {
      const status = statusFromAudit(audit.after);
      const event = status ? toTimelineEvent(status, audit.createdAt) : null;
      return event ? [event] : [];
    });
    if (!events.some((event) => event.type === 'created')) {
      events.unshift({
        occurredAt: session.createdAt.toISOString(),
        type: 'created',
      });
    }
    if (firstMeter) {
      events.push({
        occurredAt: firstMeter.sampledAt.toISOString(),
        type: 'first_measurement',
      });
    }
    events.sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt),
    );
    return { events, sessionId: session.id };
  }

  async getMetrics(sessionId: string, user: AuthUser, maxPoints: number) {
    const session = await this.requireSession(sessionId, user);
    const [points, aggregate] = await Promise.all([
      this.repository.getMeterPoints(session.id, maxPoints),
      this.prisma.meterValue.aggregate({
        _avg: { powerKw: true },
        _count: true,
        _max: { powerKw: true },
        where: { chargingSessionId: session.id },
      }),
    ]);
    return {
      points: points.map((point: MeterPointRow) => ({
        accumulatedEnergyKwh: Number(point.energyKwh),
        powerKw: point.powerKw === null ? null : Number(point.powerKw),
        sampledAt: point.sampledAt.toISOString(),
      })),
      sessionId: session.id,
      summary: {
        averagePowerKw:
          aggregate._avg.powerKw === null
            ? null
            : Number(aggregate._avg.powerKw.toFixed(2)),
        maximumPowerKw:
          aggregate._max.powerKw === null
            ? null
            : Number(aggregate._max.powerKw.toFixed(2)),
        originalPointCount: aggregate._count,
        returnedPointCount: points.length,
      },
    };
  }

  private async assertVehicleOwnership(
    vehicleId: string | undefined,
    user: AuthUser,
  ): Promise<void> {
    if (!vehicleId) return;
    const vehicle = await this.prisma.vehicle.findFirst({
      select: { id: true },
      where: {
        deletedAt: null,
        id: vehicleId,
        userId: user.sub,
        user: { deletedAt: null, tenantId: user.tenantId },
      },
    });
    if (!vehicle) throw new NotFoundException('Veiculo nao encontrado.');
  }

  private async requireSession(
    sessionId: string,
    user: AuthUser,
  ): Promise<HistorySession> {
    const session = await this.repository.getOwnedSession(sessionId, user);
    if (!session) throw new NotFoundException('Sessao nao encontrada.');
    return session;
  }
}
