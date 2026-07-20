import {
  calculateEnergyKwh,
  calculateEstimatedPrice,
  calculatePriceBreakdown,
} from '@/utils/charging';
import { formatCurrency } from '@/utils/format';

describe('charging calculations', () => {
  it('calculates energy from Wh meters', () => {
    expect(calculateEnergyKwh(100_000, 124_650)).toBe(24.65);
  });

  it('rejects a backwards meter', () => {
    expect(() => calculateEnergyKwh(200, 100)).toThrow();
  });

  it('calculates the estimated price and final breakdown', () => {
    expect(calculateEstimatedPrice(10, 2.19)).toBe(21.9);
    expect(calculatePriceBreakdown(20, 2.19).totalAmount).toBeGreaterThan(40);
  });

  it('formats BRL values', () => {
    expect(formatCurrency(12.5)).toContain('12,50');
  });
});
