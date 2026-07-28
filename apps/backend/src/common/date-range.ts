import { BadRequestException } from '@nestjs/common';

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export interface ResolvedDateRange {
  from: Date;
  timezone: string;
  to: Date;
}

interface CalendarParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

function calendarParts(date: Date, timezone: string): CalendarParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    month: value('month'),
    second: value('second'),
    year: value('year'),
  };
}

function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    throw new BadRequestException({
      code: 'INVALID_TIMEZONE',
      message: 'Timezone invalido.',
    });
  }
}

function zonedDateToUtc(parts: CalendarParts, timezone: string): Date {
  const targetTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let candidate = new Date(targetTimestamp);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const rendered = calendarParts(candidate, timezone);
    const renderedTimestamp = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    candidate = new Date(
      candidate.getTime() + targetTimestamp - renderedTimestamp,
    );
  }
  return candidate;
}

function parseIso(value: string, field: 'from' | 'to'): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: `O parametro ${field} deve ser uma data ISO valida.`,
    });
  }
  return parsed;
}

export function resolveDateRange(
  input: { from?: string; timezone?: string; to?: string },
  now = new Date(),
): ResolvedDateRange {
  const timezone = input.timezone?.trim() || 'America/Sao_Paulo';
  assertTimezone(timezone);

  if (Boolean(input.from) !== Boolean(input.to)) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: 'Informe from e to juntos.',
    });
  }

  const to = input.to ? parseIso(input.to, 'to') : now;
  const currentParts = calendarParts(now, timezone);
  const from = input.from
    ? parseIso(input.from, 'from')
    : zonedDateToUtc(
        {
          day: 1,
          hour: 0,
          minute: 0,
          month: currentParts.month,
          second: 0,
          year: currentParts.year,
        },
        timezone,
      );

  if (from.getTime() > to.getTime()) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: 'A data inicial nao pode ser posterior a data final.',
    });
  }
  if (
    from.getTime() > now.getTime() ||
    to.getTime() > now.getTime() + 60_000
  ) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: 'O periodo nao pode estar no futuro.',
    });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new BadRequestException({
      code: 'DATE_RANGE_TOO_LARGE',
      message: 'O periodo maximo permitido e de 366 dias.',
    });
  }

  return { from, timezone, to };
}
