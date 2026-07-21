import { Prisma } from '@solis/database';

import {
  calculateChargingPrice,
  estimateBatteryPercent,
  type TariffSnapshot,
} from './domain/tariff-calculator';

export const chargingSessionInclude = {
  connector: true,
  station: true,
  tariff: true,
  vehicle: true,
} satisfies Prisma.ChargingSessionInclude;

export type ChargingSessionRecord = Prisma.ChargingSessionGetPayload<{
  include: typeof chargingSessionInclude;
}>;

export interface ChargingSessionMetrics {
  currentPowerKw: number;
  elapsedSeconds: number;
  energyKwh: number;
  estimatedBatteryPercent: number;
  estimatedCost: number;
  occurredAt: string;
  sessionId: string;
  status: string;
}

function numberField(
  source: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = Number(source[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function readTariffSnapshot(value: Prisma.JsonValue): TariffSnapshot {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    activationFee: numberField(source, 'activationFee', 0),
    currency:
      typeof source.currency === 'string' ? source.currency : 'BRL',
    initialBatteryPercent: numberField(source, 'initialBatteryPercent', 30),
    parkingFeeHour: numberField(source, 'parkingFeeHour', 0),
    pricePerKwh: numberField(source, 'pricePerKwh', 0),
  };
}

export function sessionDurationSeconds(
  session: Pick<
    ChargingSessionRecord,
    'completedAt' | 'startedAt' | 'stoppedAt'
  >,
  now = new Date(),
): number {
  if (!session.startedAt) return 0;
  const end = session.completedAt ?? session.stoppedAt ?? now;
  return Math.max(
    0,
    Math.floor((end.getTime() - session.startedAt.getTime()) / 1000),
  );
}

export function toChargingSessionMetrics(
  session: ChargingSessionRecord,
  now = new Date(),
): ChargingSessionMetrics {
  const energyKwh = Number(session.energyKwh);
  const tariff = readTariffSnapshot(session.tariffSnapshot);
  const durationSeconds = sessionDurationSeconds(session, now);
  const price = calculateChargingPrice(energyKwh, durationSeconds, tariff);
  return {
    currentPowerKw: Number(session.currentPowerKw),
    elapsedSeconds: durationSeconds,
    energyKwh,
    estimatedBatteryPercent: estimateBatteryPercent(
      tariff.initialBatteryPercent,
      energyKwh,
      Number(session.vehicle.batteryCapacityKwh),
    ),
    estimatedCost: price.totalAmount,
    occurredAt: now.toISOString(),
    sessionId: session.id,
    status: session.status.toLowerCase(),
  };
}

export function toChargingSessionDto(session: ChargingSessionRecord) {
  const tariff = readTariffSnapshot(session.tariffSnapshot);
  const metrics = toChargingSessionMetrics(session);
  return {
    ...metrics,
    id: session.id,
    chargePointId: session.chargePointId,
    connectorId: session.connectorId,
    connectorLabel:
      session.connector.plugType +
      ' - ' +
      Number(session.connector.maximumPowerKw) +
      ' kW',
    createdAt: session.createdAt.toISOString(),
    evseId: session.evseId,
    failureReason: session.failureReason ?? undefined,
    paymentMethodId: 'account-default',
    startedAt: (session.startedAt ?? session.createdAt).toISOString(),
    stationId: session.stationId,
    stationName: session.station.name,
    tariffPerKwh: tariff.pricePerKwh,
    totalAmount: Number(session.totalAmount),
    vehicleId: session.vehicleId,
    version: session.version,
  };
}

export function toChargingSummaryDto(session: ChargingSessionRecord) {
  const tariff = readTariffSnapshot(session.tariffSnapshot);
  const durationSeconds = sessionDurationSeconds(session);
  const energyKwh = Number(session.energyKwh);
  const price = calculateChargingPrice(energyKwh, durationSeconds, tariff);
  return {
    avoidedCo2Kg: Math.round(energyKwh * 0.0817 * 100) / 100,
    durationSeconds,
    energyKwh,
    paymentMethodId: 'account-default',
    price: {
      activationFee: price.activationFee,
      discountAmount: 0,
      energyAmount: price.energyAmount,
      parkingFee: price.parkingFee,
      taxAmount: 0,
      totalAmount: price.totalAmount,
    },
    session: toChargingSessionDto(session),
    stoppedAt: (
      session.completedAt ??
      session.stoppedAt ??
      new Date()
    ).toISOString(),
  };
}
