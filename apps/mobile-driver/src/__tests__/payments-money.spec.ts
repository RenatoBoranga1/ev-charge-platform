import { decimalInputToMinor, formatMinorMoney } from '@/utils/format';

describe('mobile monetary boundaries', () => {
  it.each([
    ['0', 'R$ 0,00'],
    ['1', 'R$ 0,01'],
    ['1050', 'R$ 10,50'],
    ['123456789012345678', 'R$ 1.234.567.890.123.456,78'],
    ['-99', '-R$ 0,99'],
  ])('formats minor units without floating point (%s)', (minor, formatted) => {
    expect(formatMinorMoney(minor, 'BRL')).toBe(formatted);
  });

  it.each([
    ['50', '5000'],
    ['50,10', '5010'],
    ['1.234,56', '123456'],
    ['0,01', '1'],
  ])('parses a decimal input to minor units (%s)', (input, minor) => {
    expect(decimalInputToMinor(input)).toBe(minor);
  });

  it.each(['', '-1', '1,001', 'texto'])('rejects invalid decimal input (%s)', (input) => {
    expect(decimalInputToMinor(input)).toBeNull();
  });
});
