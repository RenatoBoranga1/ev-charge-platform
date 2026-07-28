import { Injectable, NotFoundException } from '@nestjs/common';
import { ChargingSessionStatus, Prisma } from '@solis/database';

import type { AuthUser } from '../auth/auth-user';
import { resolveDateRange } from '../common/date-range';
import { PrismaService } from '../database/prisma.service';
import type { DashboardQueryDto } from './dto/dashboard-query.dto';

const sessionSelection = {
  completedAt: true,
  connector: {
    select: { plugType: true },
  },
  createdAt: true,
  energyKwh: true,
  id: true,
  startedAt: true,
  station: {
    select: { city: true, id: true, name: true, tenantId: true },
  },
  status: true,
  stoppedAt: true,
  tariffSnapshot: true,
  totalAmount: true,
  vehicle: {
    select: { brand: true, id: true, model: true, nickname: true },
  },
} satisfies Prisma.ChargingSessionSelect;

type DashboardSession = Prisma.ChargingSessionGetPayload<{
  select: typeof sessionSelection;
}>;

export interface UsageAggregate {
  city?: string;
  energyKwh: number;
  id: string;
  name: string;
  sessionCount: number;
}

function durationSeconds(session: DashboardSession, now: Date): number {
  if (!session.startedAt) return 0;
  const end = session.completedAt ?? session.stoppedAt ?? now;
  return Math.max(
    0,
    Math.floor((end.getTime() - session.startedAt.getTime()) / 1000),
  );
}

function tariffCurrency(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const currency = (value as Record<string, unknown>).currency;
  return typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)
    ? currency
    : null;
}

function sessionCost(
  session: DashboardSession,
): { amount: Prisma.Decimal; currency: string } | null {
  if (session.status !== ChargingSessionStatus.COMPLETED) return null;
  const currency = tariffCurrency(session.tariffSnapshot);
  if (!currency || session.totalAmount.isNegative()) return null;
  return { amount: session.totalAmount, currency };
}

function aggregateUsage(sessions: DashboardSession[]): {
  connector: { sessionCount: number; type: string } | null;
  station: UsageAggregate | null;
} {
  const stationUsage = new Map<string, UsageAggregate>();
  const connectorUsage = new Map<string, number>();
  for (const session of sessions) {
    const current = stationUsage.get(session.station.id) ?? {
      city: session.station.city,
      energyKwh: 0,
      id: session.station.id,
      name: session.station.name,
      sessionCount: 0,
    };
    current.energyKwh += Math.max(0, Number(session.energyKwh));
    current.sessionCount += 1;
    stationUsage.set(session.station.id, current);
    const connector = session.connector.plugType.toLowerCase();
    connectorUsage.set(connector, (connectorUsage.get(connector) ?? 0) + 1);
  }
  const station =
    [...stationUsage.values()].sort(
      (left, right) =>
        right.sessionCount - left.sessionCount ||
        right.energyKwh - left.energyKwh ||
        left.name.localeCompare(right.name),
    )[0] ?? null;
  const connectorEntry =
    [...connectorUsage.entries()].sort(
      ([leftType, leftCount], [rightType, rightCount]) =>
        rightCount - leftCount || leftType.localeCompare(rightType),
    )[0] ?? null;
  return {
    connector: connectorEntry
      ? { sessionCount: connectorEntry[1], type: connectorEntry[0] }
      : null,
    station,
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(user: AuthUser, query: DashboardQueryDto) {
    const period = resolveDateRange(query);
    if (query.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        select: { id: true },
        where: {
          deletedAt: null,
          id: query.vehicleId,
          userId: user.sub,
          user: { deletedAt: null, tenantId: user.tenantId },
        },
      });
      if (!vehicle) throw new NotFoundException('Veiculo nao encontrado.');
    }

    const [profile, primaryVehicle, sessions] = await Promise.all([
      this.prisma.user.findFirst({
        select: { firstName: true, id: true, name: true },
        where: {
          deletedAt: null,
          id: user.sub,
          tenantId: user.tenantId,
        },
      }),
      this.prisma.vehicle.findFirst({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: {
          batteryCapacityKwh: true,
          brand: true,
          id: true,
          model: true,
          nickname: true,
          supportedPlugTypes: true,
          year: true,
        },
        where: {
          deletedAt: null,
          ...(query.vehicleId ? { id: query.vehicleId } : {}),
          userId: user.sub,
        },
      }),
      this.prisma.chargingSession.findMany({
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: sessionSelection,
        where: {
          deletedAt: null,
          ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
          station: { deletedAt: null, tenantId: user.tenantId },
          userId: user.sub,
          OR: [
            { startedAt: { gte: period.from, lte: period.to } },
            {
              createdAt: { gte: period.from, lte: period.to },
              startedAt: null,
            },
          ],
        },
      }),
    ]);
    if (!profile) throw new NotFoundException('Usuario nao encontrado.');

    const costs = sessions.flatMap((session) => {
      const cost = sessionCost(session);
      return cost ? [cost] : [];
    });
    const currencies = new Set(costs.map((cost) => cost.currency));
    const totalCost =
      costs.length > 0 && currencies.size === 1
        ? costs.reduce(
            (total, cost) => total.plus(cost.amount),
            new Prisma.Decimal(0),
          )
        : null;
    const totalDurationSeconds = sessions.reduce(
      (total, session) => total + durationSeconds(session, period.to),
      0,
    );
    const totalEnergyKwh = sessions.reduce(
      (total, session) => total + Math.max(0, Number(session.energyKwh)),
      0,
    );
    const usage = aggregateUsage(sessions);
    const last = sessions[0];
    const lastCost = last ? sessionCost(last) : null;

    return {
      driver: {
        firstName:
          profile.firstName ?? profile.name.split(' ')[0] ?? profile.name,
        name: profile.name,
      },
      lastSession: last
        ? {
            connector: last.connector.plugType.toLowerCase(),
            cost: lastCost
              ? {
                  amount: lastCost.amount.toFixed(2),
                  currency: lastCost.currency,
                }
              : null,
            durationSeconds: durationSeconds(last, period.to),
            endedAt:
              (last.completedAt ?? last.stoppedAt)?.toISOString() ?? null,
            energyKwh: Math.max(0, Number(last.energyKwh)),
            id: last.id,
            startedAt: (last.startedAt ?? last.createdAt).toISOString(),
            station: {
              city: last.station.city,
              id: last.station.id,
              name: last.station.name,
            },
            status: last.status.toLowerCase(),
            vehicle: last.vehicle,
          }
        : null,
      mostUsedConnector: usage.connector,
      mostUsedStation: usage.station,
      period: {
        from: period.from.toISOString(),
        timezone: period.timezone,
        to: period.to.toISOString(),
      },
      primaryVehicle: primaryVehicle
        ? {
            ...primaryVehicle,
            batteryCapacityKwh: Number(primaryVehicle.batteryCapacityKwh),
            connectorTypes: primaryVehicle.supportedPlugTypes.map((type) =>
              type.toLowerCase(),
            ),
          }
        : null,
      summary: {
        avoidedCo2Kg: null,
        averageDurationSeconds:
          sessions.length > 0
            ? Math.round(totalDurationSeconds / sessions.length)
            : 0,
        averageEnergyPerSession:
          sessions.length > 0
            ? Number((totalEnergyKwh / sessions.length).toFixed(3))
            : 0,
        cancelledSessions: sessions.filter(
          (session) => session.status === ChargingSessionStatus.CANCELLED,
        ).length,
        completedSessions: sessions.filter(
          (session) => session.status === ChargingSessionStatus.COMPLETED,
        ).length,
        currency: totalCost ? [...currencies][0] : null,
        estimatedSavings: null,
        failedSessions: sessions.filter(
          (session) => session.status === ChargingSessionStatus.FAILED,
        ).length,
        totalCost: totalCost?.toFixed(2) ?? null,
        totalDurationSeconds,
        totalEnergyKwh: Number(totalEnergyKwh.toFixed(3)),
        totalSessions: sessions.length,
      },
    };
  }
}
