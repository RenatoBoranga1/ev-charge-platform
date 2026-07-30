import { Money, type MoneyOptions } from './money';

export class MoneyParser {
  static minorUnits(
    amountMinor: string | bigint,
    currency = 'BRL',
    options: MoneyOptions = {},
  ): Money {
    return Money.fromMinorUnits(amountMinor, currency, options);
  }

  static decimal(
    value: string | { toString(): string },
    currency = 'BRL',
    options: MoneyOptions = {},
  ): Money {
    return Money.fromDecimal(value, currency, options);
  }
}
