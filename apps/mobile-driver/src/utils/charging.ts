import type { PriceBreakdown } from '@/types/domain';

export function calculateEnergyKwh(
  meterStartWh: number,
  meterStopWh: number,
): number {
  if (meterStopWh < meterStartWh) {
    throw new Error('O medidor final não pode ser menor que o inicial.');
  }

  return Number(((meterStopWh - meterStartWh) / 1000).toFixed(3));
}

export function calculateEstimatedPrice(
  energyKwh: number,
  pricePerKwh: number,
): number {
  return Number((Math.max(energyKwh, 0) * Math.max(pricePerKwh, 0)).toFixed(2));
}

export function calculatePriceBreakdown(
  energyKwh: number,
  pricePerKwh: number,
): PriceBreakdown {
  const energyAmount = calculateEstimatedPrice(energyKwh, pricePerKwh);
  const activationFee = 2.5;
  const parkingFee = 0;
  const discountAmount = energyAmount >= 40 ? 3 : 0;
  const taxableAmount = energyAmount + activationFee + parkingFee - discountAmount;
  const taxAmount = Number((taxableAmount * 0.05).toFixed(2));

  return {
    energyAmount,
    activationFee,
    parkingFee,
    discountAmount,
    taxAmount,
    totalAmount: Number((taxableAmount + taxAmount).toFixed(2)),
  };
}

export function estimateAvoidedCo2(energyKwh: number): number {
  return Number((energyKwh * 0.57).toFixed(2));
}
