import type { DashboardPeriod, DashboardQuery } from '@/types/domain';

export type DashboardPeriodPreset = 'CURRENT_MONTH' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

function startOfLocalMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
}

export function dashboardPeriodQuery(
  preset: Exclude<DashboardPeriodPreset, 'CUSTOM'>,
  now = new Date(),
): DashboardQuery {
  const from =
    preset === 'CURRENT_MONTH'
      ? startOfLocalMonth(now)
      : new Date(now.getTime() - (preset === 'LAST_7_DAYS' ? 7 : 30) * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    timezone: deviceTimezone(),
    to: now.toISOString(),
  };
}

export function customPeriodQuery(
  fromDate: string,
  toDate: string,
  now = new Date(),
): DashboardQuery {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Informe datas válidas no formato AAAA-MM-DD.');
  }
  if (from.getTime() > to.getTime()) {
    throw new Error('A data inicial deve ser anterior à data final.');
  }
  if (to.getTime() > now.getTime()) {
    throw new Error('O período não pode terminar no futuro.');
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new Error('O período máximo é de 366 dias.');
  }
  return {
    from: from.toISOString(),
    timezone: deviceTimezone(),
    to: to.toISOString(),
  };
}

export function periodLabel(period: DashboardPeriod): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: period.timezone,
  });
  return `${formatter.format(new Date(period.from))} – ${formatter.format(new Date(period.to))}`;
}
