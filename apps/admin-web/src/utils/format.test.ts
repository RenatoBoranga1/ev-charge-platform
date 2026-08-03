import {
  formatCurrency,
  formatDateTime,
  formatMinorCurrency,
  truncateId,
} from './format';

describe('format utilities', () => {
  it('formats decimal and minor-unit money without floating input leakage', () => {
    expect(formatCurrency('12.34')).toContain('12,34');
    expect(formatMinorCurrency('1234')).toContain('12,34');
    expect(formatCurrency('invalid')).toContain('0,00');
  });

  it('formats valid dates and protects invalid values', () => {
    expect(formatDateTime('2026-07-30T12:00:00.000Z')).not.toBe('—');
    expect(formatDateTime('invalid')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });

  it('shortens long identifiers only', () => {
    expect(truncateId('1234567890123456')).toBe('12345678…');
    expect(truncateId('short')).toBe('short');
  });
});
