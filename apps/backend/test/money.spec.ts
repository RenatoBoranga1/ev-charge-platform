import {
  Money,
  MoneyCalculator,
  MoneyFormatter,
  MoneyParser,
  MoneySerializer,
} from '../src/payments/money';

describe('Money', () => {
  it('creates zero and positive minor-unit values without using numbers', () => {
    expect(Money.zero().toHttp()).toEqual({ amountMinor: '0', currency: 'BRL' });
    expect(Money.fromMinorUnits('12990').amountMinor).toBe(12_990n);
    expect(Money.fromMinorUnits(100n).isZero()).toBe(false);
  });

  it('rejects malformed minor units, lowercase currency and negative public values', () => {
    expect(() => Money.fromMinorUnits('1.00')).toThrow(TypeError);
    expect(() => Money.fromMinorUnits('abc')).toThrow(TypeError);
    expect(() => Money.fromMinorUnits(-1n)).toThrow('Negative money');
    expect(() => Money.fromMinorUnits(1n, 'brl')).toThrow('ISO-4217');
    expect(() => Money.fromMinorUnits(1n, 'REAL')).toThrow('ISO-4217');
  });

  it('allows a negative internal value only when explicitly requested', () => {
    const internal = Money.fromMinorUnits('-25', 'BRL', { allowNegative: true });
    expect(internal.isNegative()).toBe(true);
    expect(internal.toHttp().amountMinor).toBe('-25');
  });

  it.each([
    ['1', '100'],
    ['1.2', '120'],
    ['1.234', '123'],
    ['1.235', '124'],
    ['0.0049', '0'],
    ['0.005', '1'],
    ['129.90', '12990'],
  ])('converts decimal %s with half-away-from-zero rounding', (decimal, minor) => {
    expect(Money.fromDecimal(decimal).toHttp().amountMinor).toBe(minor);
  });

  it('accepts Prisma-like Decimal values through toString', () => {
    expect(Money.fromDecimal({ toString: () => '10.50' }).amountMinor).toBe(1050n);
  });

  it('rejects malformed decimal input and implicit negative decimal input', () => {
    expect(() => Money.fromDecimal('1,00')).toThrow(TypeError);
    expect(() => Money.fromDecimal('Infinity')).toThrow(TypeError);
    expect(() => Money.fromDecimal('-1.00')).toThrow(RangeError);
  });

  it('adds, subtracts, compares and checks equality', () => {
    const one = Money.fromMinorUnits(100n);
    const two = Money.fromMinorUnits(200n);
    expect(one.add(two).amountMinor).toBe(300n);
    expect(two.subtract(one).amountMinor).toBe(100n);
    expect(one.compare(two)).toBe(-1);
    expect(two.compare(one)).toBe(1);
    expect(one.compare(Money.fromMinorUnits(100n))).toBe(0);
    expect(one.equals(Money.fromMinorUnits('100'))).toBe(true);
    expect(one.equals(Money.fromMinorUnits('100', 'USD'))).toBe(false);
  });

  it('does not let subtraction create a negative public value', () => {
    expect(() => Money.fromMinorUnits(1n).subtract(Money.fromMinorUnits(2n))).toThrow(
      'Negative money',
    );
    expect(
      Money.fromMinorUnits(1n)
        .subtract(Money.fromMinorUnits(2n), { allowNegative: true })
        .amountMinor,
    ).toBe(-1n);
  });

  it('rejects mixed currency arithmetic', () => {
    const brl = Money.fromMinorUnits(1n, 'BRL');
    const usd = Money.fromMinorUnits(1n, 'USD');
    expect(() => brl.add(usd)).toThrow('different currencies');
    expect(() => brl.subtract(usd)).toThrow('different currencies');
    expect(() => brl.compare(usd)).toThrow('different currencies');
  });

  it('enforces a configurable maximum and a valid maximum configuration', () => {
    expect(() =>
      Money.fromMinorUnits(101n, 'BRL', { maximumAmountMinor: 100n }),
    ).toThrow('configured maximum');
    expect(() =>
      Money.fromMinorUnits(1n, 'BRL', { maximumAmountMinor: 0n }),
    ).toThrow('Maximum amount');
  });

  it('serializes bigint exclusively as a string', () => {
    const serialized = MoneySerializer.toHttp(MoneyParser.minorUnits('5000'));
    expect(serialized).toEqual({ amountMinor: '5000', currency: 'BRL' });
    expect(JSON.stringify(serialized)).toBe('{"amountMinor":"5000","currency":"BRL"}');
  });

  it('formats without converting the canonical amount to number', () => {
    expect(MoneyFormatter.format(Money.fromMinorUnits(123_456_789n))).toBe(
      'R$ 1.234.567,89',
    );
    expect(
      MoneyFormatter.format(
        Money.fromMinorUnits(-123n, 'USD', { allowNegative: true }),
        'en-US',
      ),
    ).toBe('-USD 1.23');
  });

  it('calculates sums, limits and rounded ratios', () => {
    const low = Money.fromMinorUnits(100n);
    const high = Money.fromMinorUnits(201n);
    expect(MoneyCalculator.sum([low, high]).amountMinor).toBe(301n);
    expect(MoneyCalculator.minimum(low, high)).toBe(low);
    expect(MoneyCalculator.maximum(low, high)).toBe(high);
    expect(MoneyCalculator.multiplyRatio(high, 1n, 2n).amountMinor).toBe(101n);
    expect(() => MoneyCalculator.multiplyRatio(low, -1n, 2n)).toThrow(RangeError);
    expect(() => MoneyCalculator.multiplyRatio(low, 1n, 0n)).toThrow(RangeError);
  });

  it('covers parser boundaries and every calculator branch', () => {
    expect(MoneyParser.decimal('10.05', 'USD').toHttp()).toEqual({
      amountMinor: '1005',
      currency: 'USD',
    });
    expect(MoneyParser.decimal('1').amountMinor).toBe(100n);
    expect(MoneyParser.decimal('1', 'BRL', { maximumAmountMinor: 100n }).amountMinor).toBe(100n);
    const low = Money.fromMinorUnits(100n);
    const high = Money.fromMinorUnits(201n);
    expect(MoneyCalculator.sum([], 'USD')).toEqual(Money.zero('USD'));
    expect(MoneyCalculator.minimum(high, low)).toBe(low);
    expect(MoneyCalculator.maximum(low, high)).toBe(high);
    expect(MoneyCalculator.maximum(high, low)).toBe(high);
    expect(MoneyCalculator.multiplyRatio(low, 1n, 2n).amountMinor).toBe(50n);
    expect(MoneyCalculator.multiplyRatio(low, 0n, 2n).amountMinor).toBe(0n);
    expect(() => MoneyCalculator.multiplyRatio(low, 1n, -1n)).toThrow(RangeError);
  });
});
