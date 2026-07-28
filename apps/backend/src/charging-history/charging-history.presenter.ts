import { ChargingSessionStatus, Prisma } from '@solis/database';

export const historySessionInclude = {
  chargePoint: {
    select: { externalCode: true, id: true, name: true },
  },
  connector: {
    select: {
      code: true,
      id: true,
      maximumPowerKw: true,
      number: true,
      plugType: true,
    },
  },
  evse: {
    select: { id: true, uid: true },
  },
  station: {
    select: {
      address: true,
      city: true,
      id: true,
      latitude: true,
      longitude: true,
      name: true,
      tenantId: true,
    },
  },
  tariff: {
    select: {
      activationFee: true,
      currency: true,
      name: true,
      parkingFeeHour: true,
      pricePerKwh: true,
    },
  },
  vehicle: {
    select: { brand: true, id: true, model: true, nickname: true },
  },
} satisfies Prisma.ChargingSessionInclude;

export type HistorySession = Prisma.ChargingSessionGetPayload<{
  include: typeof historySessionInclude;
}>;

export interface SessionPowerSummary {
  averagePowerKw: number | null;
  maximumPowerKw: number | null;
}

function durationSeconds(session: HistorySession, now = new Date()): number {
  if (!session.startedAt) return 0;
  const end = session.completedAt ?? session.stoppedAt ?? now;
  return Math.max(
    0,
    Math.floor((end.getTime() - session.startedAt.getTime()) / 1000),
  );
}

function trustedCost(
  session: HistorySession,
): { amount: string; currency: string } | null {
  if (
    session.status !== ChargingSessionStatus.COMPLETED ||
    !/^[A-Z]{3}$/.test(session.tariff.currency) ||
    session.totalAmount.isNegative()
  ) {
    return null;
  }
  return {
    amount: session.totalAmount.toFixed(2),
    currency: session.tariff.currency,
  };
}

function safeEnergyKwh(session: HistorySession): number {
  const consolidated = Number(session.energyKwh);
  if (Number.isFinite(consolidated) && consolidated >= 0) {
    return Number(consolidated.toFixed(3));
  }
  if (
    session.meterStartWh !== null &&
    session.meterStopWh !== null &&
    session.meterStopWh >= session.meterStartWh
  ) {
    return Number(
      (Number(session.meterStopWh - session.meterStartWh) / 1000).toFixed(3),
    );
  }
  return 0;
}

export function toHistoryItem(session: HistorySession) {
  return {
    connector: {
      id: session.connector.id,
      label: `${session.connector.plugType} · ${Number(
        session.connector.maximumPowerKw,
      )} kW`,
      type: session.connector.plugType.toLowerCase(),
    },
    cost: trustedCost(session),
    durationSeconds: durationSeconds(session),
    endedAt:
      (session.completedAt ?? session.stoppedAt)?.toISOString() ?? null,
    energyKwh: safeEnergyKwh(session),
    failureReason:
      session.status === ChargingSessionStatus.FAILED
        ? session.failureReason
        : null,
    id: session.id,
    startedAt: (session.startedAt ?? session.createdAt).toISOString(),
    station: {
      city: session.station.city,
      id: session.station.id,
      name: session.station.name,
    },
    status: session.status.toLowerCase(),
    vehicle: session.vehicle,
  };
}

export function toSessionDetails(
  session: HistorySession,
  power: SessionPowerSummary,
) {
  return {
    ...toHistoryItem(session),
    audit: {
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      version: session.version,
    },
    chargePoint: session.chargePoint,
    connector: {
      ...toHistoryItem(session).connector,
      code: session.connector.code,
      number: session.connector.number,
    },
    evse: session.evse,
    failureReason: session.failureReason,
    meter: {
      startWh: session.meterStartWh?.toString() ?? null,
      stopWh: session.meterStopWh?.toString() ?? null,
    },
    power,
    station: {
      ...toHistoryItem(session).station,
      address: session.station.address,
      latitude: Number(session.station.latitude),
      longitude: Number(session.station.longitude),
    },
    stopReason: session.failureReason,
    tariff:
      trustedCost(session) !== null
        ? {
            activationFee: session.tariff.activationFee.toFixed(2),
            currency: session.tariff.currency,
            name: session.tariff.name,
            parkingFeeHour: session.tariff.parkingFeeHour.toFixed(2),
            pricePerKwh: session.tariff.pricePerKwh.toFixed(4),
          }
        : null,
  };
}

export function toTimelineEvent(
  status: string,
  occurredAt: Date,
): { occurredAt: string; type: string } | null {
  const eventByStatus: Record<string, string> = {
    AUTHORIZED: 'authorized',
    CANCELLED: 'cancelled',
    CHARGING: 'charging_started',
    COMPLETED: 'completed',
    FAILED: 'failed',
    PENDING: 'created',
    STARTING: 'starting',
    STOPPING: 'stopping',
  };
  const type = eventByStatus[status];
  return type ? { occurredAt: occurredAt.toISOString(), type } : null;
}
