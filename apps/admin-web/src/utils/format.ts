export function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function formatCurrency(value: unknown, currency = 'BRL'): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    currency,
    style: 'currency',
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatMinorCurrency(
  value: unknown,
  currency = 'BRL',
): string {
  const minor = typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
  return formatCurrency(Number.isFinite(minor) ? minor / 100 : 0, currency);
}

export function truncateId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
