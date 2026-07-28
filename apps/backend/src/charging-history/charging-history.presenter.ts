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
export interface HistoryTariffSnapshot {
  activationFee: string;
  currency: string;
  name: string;
  parkingFeeHour: string;
  pricePerKwh: string;
}

function decimalSnapshotField(
  source: Record<string, unknown>,
  key: string,
  fractionDigits: number,
): string | null {
  const value = source[key];
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  try {
    const decimal = new Prisma.Decimal(value);
    return decimal.isFinite() && !decimal.isNegative()
      ? decimal.toFixed(fractionDigits)
      : null;
  } catch {
    return null;
  }
}

function trustedTariffSnapshot(
  session: HistorySession,
): HistoryTariffSnapshot | null {
  const value = session.tariffSnapshot;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const currency = source.currency;
  const activationFee = decimalSnapshotField(source, 'activationFee', 2);
  const parkingFeeHour = decimalSnapshotField(source, 'parkingFeeHour', 2);
  const pricePerKwh = decimalSnapshotField(source, 'pricePerKwh', 4);
  if (
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency) ||
    activationFee === null ||
    parkingFeeHour === null ||
    pricePerKwh === null
  ) {
    return null;
  }
  return {
    activationFee,
    currency,
    name:
      typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : 'Tarifa registrada',
    parkingFeeHour,
    pricePerKwh,
  };
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
  tariff = trustedTariffSnapshot(session),
): { amount: string; currency: string } | null {
  if (
    session.status !== ChargingSessionStatus.COMPLETED ||
    !tariff ||
    session.totalAmount.isNegative()
  ) {
    return null;
  }
  return {
    amount: session.totalAmount.toFixed(2),
    currency: tariff.currency,
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

export function toHistoryItem(
  session: HistorySession,
  now = new Date(),
) {
  const tariff = trustedTariffSnapshot(session);
  return {
    connector: {
      id: session.connector.id,
      label: `${session.connector.plugType} · ${Number(
        session.connector.maximumPowerKw,
      )} kW`,
      type: session.connector.plugType.toLowerCase(),
    },
    cost: trustedCost(session, tariff),
    durationSeconds: durationSeconds(session, now),
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
  now = new Date(),
) {
  const item = toHistoryItem(session, now);
  const tariff = trustedTariffSnapshot(session);
  return {
    ...item,
    audit: {
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      version: session.version,
    },
    chargePoint: session.chargePoint,
    connector: {
      ...item.connector,
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
      ...item.station,
      address: session.station.address,
      latitude: Number(session.station.latitude),
      longitude: Number(session.station.longitude),
    },
    stopReason: session.failureReason,
    tariff: trustedCost(session, tariff) !== null ? tariff : null,
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
