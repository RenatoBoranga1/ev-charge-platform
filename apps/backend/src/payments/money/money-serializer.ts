import { Money, type MoneyHttp } from './money';

export class MoneySerializer {
  static toHttp(value: Money): MoneyHttp {
    return value.toHttp();
  }
}
