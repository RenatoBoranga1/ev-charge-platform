export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatMoney(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat('pt-BR', {
      currency,
      style: 'currency',
    }).format(amount);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatMinorMoney(value: string, currency: string): string {
  if (!/^-?\d+$/.test(value)) return `${value} ${currency}`;
  const amount = BigInt(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const units = absolute / 100n;
  const cents = (absolute % 100n).toString().padStart(2, '0');
  const grouped = units
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const symbol = currency === 'BRL' ? 'R$' : currency;
  return `${negative ? '-' : ''}${symbol} ${grouped},${cents}`;
}

export function decimalInputToMinor(value: string): string | null {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [units = '0', cents = ''] = normalized.split('.');
  return (BigInt(units) * 100n + BigInt(cents.padEnd(2, '0') || '0')).toString();
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
