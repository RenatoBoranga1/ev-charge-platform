export interface MoneyHttp {
  amountMinor: string;
  currency: string;
}

export interface MoneyOptions {
  allowNegative?: boolean;
  maximumAmountMinor?: bigint;
}

const DEFAULT_MAXIMUM_AMOUNT_MINOR = 100_000_000_000n;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const INTEGER_PATTERN = /^-?\d+$/;
const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

function normalizedCurrency(value: string): string {
  if (!CURRENCY_PATTERN.test(value)) {
    throw new RangeError('Currency must be a three-letter uppercase ISO-4217 code.');
  }
  return value;
}

function parsedMinorUnits(value: bigint | string): bigint {
  if (typeof value === 'bigint') return value;
  if (!INTEGER_PATTERN.test(value)) {
    throw new TypeError('amountMinor must be an integer string or bigint.');
  }
  return BigInt(value);
}

function assertBounds(amountMinor: bigint, options: MoneyOptions): void {
  const maximum = options.maximumAmountMinor ?? DEFAULT_MAXIMUM_AMOUNT_MINOR;
  if (maximum <= 0n) throw new RangeError('Maximum amount must be positive.');
  if (!options.allowNegative && amountMinor < 0n) {
    throw new RangeError('Negative money is not allowed.');
  }
  const magnitude = amountMinor < 0n ? -amountMinor : amountMinor;
  if (magnitude > maximum) throw new RangeError('Money exceeds the configured maximum.');
}

export class Money {
  private constructor(
    readonly amountMinor: bigint,
    readonly currency: string,
    private readonly maximumAmountMinor: bigint,
  ) {}

  static fromMinorUnits(
    value: bigint | string,
    currency = 'BRL',
    options: MoneyOptions = {},
  ): Money {
    const amountMinor = parsedMinorUnits(value);
    assertBounds(amountMinor, options);
    return new Money(
      amountMinor,
      normalizedCurrency(currency),
      options.maximumAmountMinor ?? DEFAULT_MAXIMUM_AMOUNT_MINOR,
    );
  }

  static fromDecimal(
    value: string | { toString(): string },
    currency = 'BRL',
    options: MoneyOptions = {},
  ): Money {
    const source = typeof value === 'string' ? value : value.toString();
    const match = DECIMAL_PATTERN.exec(source);
    if (!match) throw new TypeError('Decimal money must use a dot and decimal digits.');

    const negative = match[1] === '-';
    const whole = BigInt(match[2]!);
    const fraction = match[3] ?? '';
    const cents = BigInt((fraction + '00').slice(0, 2));
    const roundingDigit = fraction.length > 2 ? fraction.charCodeAt(2) - 48 : 0;
    const roundUp = roundingDigit >= 5;
    let amountMinor = whole * 100n + cents + (roundUp ? 1n : 0n);
    if (negative) amountMinor = -amountMinor;
    return Money.fromMinorUnits(amountMinor, currency, options);
  }

  static zero(currency = 'BRL', options: MoneyOptions = {}): Money {
    return Money.fromMinorUnits(0n, currency, options);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.amountMinor + other.amountMinor, this.currency, {
      allowNegative: this.isNegative() || other.isNegative(),
      maximumAmountMinor: this.maximumAmountMinor,
    });
  }

  subtract(other: Money, options: Pick<MoneyOptions, 'allowNegative'> = {}): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.amountMinor - other.amountMinor, this.currency, {
      allowNegative: options.allowNegative,
      maximumAmountMinor: this.maximumAmountMinor,
    });
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amountMinor === other.amountMinor) return 0;
    return this.amountMinor < other.amountMinor ? -1 : 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  toHttp(): MoneyHttp {
    return { amountMinor: this.amountMinor.toString(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new RangeError('Cannot operate on different currencies.');
    }
  }
}
