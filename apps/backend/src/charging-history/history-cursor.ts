import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { environment } from '../config/environment';
import { ChargingHistorySort } from './dto/charging-history-query.dto';

export interface HistoryCursor {
  asOf: string;
  id: string;
  sort: ChargingHistorySort;
  value: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class HistoryCursorCodec {
  private readonly secret = environment.historyCursorSecret;

  encode(value: HistoryCursor): string {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  decode(value: string, expectedSort: ChargingHistorySort): HistoryCursor {
    try {
      const [payload, signature, extra] = value.split('.');
      if (!payload || !signature || extra) throw new Error('Malformed cursor.');
      const expected = Buffer.from(this.sign(payload));
      const received = Buffer.from(signature);
      if (
        expected.length !== received.length ||
        !timingSafeEqual(expected, received)
      ) {
        throw new Error('Invalid signature.');
      }
      const decoded = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as Partial<HistoryCursor>;
      if (
        decoded.sort !== expectedSort ||
        typeof decoded.asOf !== 'string' ||
        Number.isNaN(new Date(decoded.asOf).getTime()) ||
        typeof decoded.value !== 'string' ||
        typeof decoded.id !== 'string' ||
        !UUID_PATTERN.test(decoded.id)
      ) {
        throw new Error('Invalid payload.');
      }
      if (
        [ChargingHistorySort.OLDEST, ChargingHistorySort.RECENT].includes(
          decoded.sort,
        )
      ) {
        if (Number.isNaN(new Date(decoded.value).getTime())) {
          throw new Error('Invalid date cursor.');
        }
      } else if (!Number.isFinite(Number(decoded.value))) {
        throw new Error('Invalid numeric cursor.');
      }
      return decoded as HistoryCursor;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'Cursor invalido ou incompativel com a ordenacao.',
      });
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }
}
