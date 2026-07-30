import { Money } from './money';

export class MoneyCalculator {
  static sum(values: readonly Money[], currency = 'BRL'): Money {
    return values.reduce((total, value) => total.add(value), Money.zero(currency));
  }

  static minimum(left: Money, right: Money): Money {
    return left.compare(right) <= 0 ? left : right;
  }

  static maximum(left: Money, right: Money): Money {
    return left.compare(right) >= 0 ? left : right;
  }

  static multiplyRatio(
    value: Money,
    numerator: bigint,
    denominator: bigint,
  ): Money {
    if (numerator < 0n || denominator <= 0n) {
      throw new RangeError('Money ratio must be nonnegative with a positive denominator.');
    }
    const product = value.amountMinor * numerator;
    const quotient = product / denominator;
    const remainder = product % denominator;
    const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
    return Money.fromMinorUnits(rounded, value.currency);
  }
}
