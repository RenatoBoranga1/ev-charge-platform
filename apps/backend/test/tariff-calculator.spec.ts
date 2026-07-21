import {
  calculateChargingPrice,
  estimateBatteryPercent,
  type TariffSnapshot,
} from '../src/charging/domain/tariff-calculator';

const tariff: TariffSnapshot = {
  activationFee: 1.5,
  currency: 'BRL',
  initialBatteryPercent: 30,
  parkingFeeHour: 2,
  pricePerKwh: 2.19,
};

describe('tariff calculator', () => {
  it('calculates energy, duration, activation and total cost', () => {
    expect(calculateChargingPrice(10, 3600, tariff)).toEqual({
      activationFee: 1.5,
      energyAmount: 21.9,
      parkingFee: 2,
      totalAmount: 25.4,
    });
  });

  it('normalizes negative meter and duration values', () => {
    expect(calculateChargingPrice(-2, -30, tariff)).toEqual({
      activationFee: 1.5,
      energyAmount: 0,
      parkingFee: 0,
      totalAmount: 1.5,
    });
  });

  it('estimates and clamps battery percentage', () => {
    expect(estimateBatteryPercent(30, 15, 60)).toBe(55);
    expect(estimateBatteryPercent(95, 20, 60)).toBe(100);
    expect(estimateBatteryPercent(-10, 0, 60)).toBe(0);
    expect(estimateBatteryPercent(42, 10, 0)).toBe(42);
  });
});
