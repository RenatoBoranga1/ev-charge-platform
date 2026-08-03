import type { ReactNode } from 'react';

export function MetricCard({
  hint,
  icon,
  label,
  value,
}: {
  hint?: string;
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <article className="metric-card">
      <span className="metric-icon" aria-hidden="true">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </article>
  );
}
