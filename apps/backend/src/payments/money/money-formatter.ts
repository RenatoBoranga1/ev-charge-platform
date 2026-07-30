import { Money } from './money';

const SYMBOLS: Readonly<Record<string, string>> = { BRL: 'R$' };

export class MoneyFormatter {
  static format(value: Money, locale = 'pt-BR'): string {
    const negative = value.amountMinor < 0n;
    const magnitude = negative ? -value.amountMinor : value.amountMinor;
    const whole = magnitude / 100n;
    const cents = (magnitude % 100n).toString().padStart(2, '0');
    const grouping = locale === 'pt-BR' ? '.' : ',';
    const decimal = locale === 'pt-BR' ? ',' : '.';
    const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, grouping);
    const symbol = SYMBOLS[value.currency] ?? value.currency;
    return `${negative ? '-' : ''}${symbol} ${grouped}${decimal}${cents}`;
  }
}
