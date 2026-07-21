export interface TariffSnapshot {
  activationFee: number;
  currency: string;
  initialBatteryPercent: number;
  parkingFeeHour: number;
  pricePerKwh: number;
}

export interface ChargingPrice {
  activationFee: number;
  energyAmount: number;
  parkingFee: number;
  totalAmount: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateChargingPrice(
  energyKwh: number,
  durationSeconds: number,
  tariff: TariffSnapshot,
): ChargingPrice {
  const normalizedEnergy = Math.max(0, energyKwh);
  const normalizedDuration = Math.max(0, durationSeconds);
  const energyAmount = roundMoney(normalizedEnergy * tariff.pricePerKwh);
  const parkingFee = roundMoney(
    (normalizedDuration / 3600) * tariff.parkingFeeHour,
  );
  return {
    activationFee: roundMoney(tariff.activationFee),
    energyAmount,
    parkingFee,
    totalAmount: roundMoney(tariff.activationFee + energyAmount + parkingFee),
  };
}

export function estimateBatteryPercent(
  initialBatteryPercent: number,
  energyKwh: number,
  batteryCapacityKwh: number,
): number {
  if (batteryCapacityKwh <= 0) return initialBatteryPercent;
  return Math.min(
    100,
    Math.max(
      0,
      Math.round(initialBatteryPercent + (energyKwh / batteryCapacityKwh) * 100),
    ),
  );
}
