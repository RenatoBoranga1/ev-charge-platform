import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { resolveDateRange } from '../src/common/date-range';
import { ChargingHistorySort } from '../src/charging-history/dto/charging-history-query.dto';
import { HistoryCursorCodec } from '../src/charging-history/history-cursor';
import { environment } from '../src/config/environment';

describe('Dashboard and history contracts', () => {
  const invalidPeriods: Array<[Parameters<typeof resolveDateRange>[0], string]> = [
    [{ from: '2026-07-01T00:00:00.000Z' }, 'Informe from e to juntos.'],
    [
      {
        from: '2026-07-10T00:00:00.000Z',
        to: '2026-07-01T00:00:00.000Z',
      },
      'A data inicial nao pode ser posterior a data final.',
    ],
    [
      {
        from: '2024-01-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      },
      'O periodo maximo permitido e de 366 dias.',
    ],
    [
      {
        from: '2026-07-01T00:00:00.000Z',
        timezone: 'Invalid/Timezone',
        to: '2026-07-10T00:00:00.000Z',
      },
      'Timezone invalido.',
    ],
    [
      {
        from: '2026-07-29T00:00:00.000Z',
        to: '2026-07-30T00:00:00.000Z',
      },
      'O periodo nao pode estar no futuro.',
    ],
  ];
  const now = new Date('2026-07-28T15:00:00.000Z');

  it('resolves the current month in the requested timezone', () => {
    const period = resolveDateRange({ timezone: 'America/Sao_Paulo' }, now);
    expect(period).toEqual({
      from: new Date('2026-07-01T03:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      to: now,
    });
  });

  it.each(invalidPeriods)('rejects invalid period %#', (input, message) => {
    expect.assertions(2);
    try {
      resolveDateRange(input, now);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message,
      });
      return;
    }
    throw new Error('Expected resolveDateRange to reject the period.');
  });

  it('signs cursors and rejects tampering or sort changes', () => {
    const codec = new HistoryCursorCodec();
    const cursor = codec.encode({
      asOf: '2026-07-28T15:00:00.000Z',
      id: 'b42d2c13-bf73-44c8-8c51-0c2369b8fe0b',
      sort: ChargingHistorySort.RECENT,
      value: '2026-07-20T00:00:00.000Z',
    });
    const [payload = '', signature] = cursor.split('.');
    const jwtSignature = createHmac('sha256', environment.jwtAccessSecret)
      .update(payload)
      .digest('base64url');
    expect(signature).not.toBe(jwtSignature);
    expect(codec.decode(cursor, ChargingHistorySort.RECENT)).toMatchObject({
      asOf: '2026-07-28T15:00:00.000Z',
      sort: ChargingHistorySort.RECENT,
    });
    expect(() => codec.decode(cursor, ChargingHistorySort.OLDEST)).toThrow(BadRequestException);
    expect(() => codec.decode(`${cursor.slice(0, -1)}x`, ChargingHistorySort.RECENT)).toThrow(
      BadRequestException,
    );
  });

  it('rejects malformed cursor payload values', () => {
    const codec = new HistoryCursorCodec();
    const malformed = codec.encode({
      asOf: '2026-07-28T15:00:00.000Z',
      id: 'b42d2c13-bf73-44c8-8c51-0c2369b8fe0b',
      sort: ChargingHistorySort.ENERGY_ASC,
      value: 'not-a-number',
    });
    expect(() => codec.decode(malformed, ChargingHistorySort.ENERGY_ASC)).toThrow(
      BadRequestException,
    );
  });
});
