const positive = new Set(['ACTIVE', 'ACCEPTED', 'AVAILABLE', 'CAPTURED', 'COMPLETED', 'CONNECTED', 'MATCHED', 'ONLINE', 'POSTED', 'PUBLISHED', 'SUCCESS']);
const warning = new Set(['AUTHORIZED', 'CHARGING', 'CREATED', 'INVITED', 'OCCUPIED', 'PARTIAL', 'PENDING', 'QUEUED', 'SENT', 'STARTING', 'STOPPING']);
const negative = new Set(['ARCHIVED', 'CANCELLED', 'DENIED', 'DISABLED', 'FAILED', 'FAULTED', 'OFFLINE', 'REJECTED', 'TIMED_OUT']);

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone = positive.has(normalized)
    ? 'positive'
    : warning.has(normalized)
      ? 'warning'
      : negative.has(normalized)
        ? 'negative'
        : 'neutral';
  return (
    <span className={`status-badge status-${tone}`}>
      <span aria-hidden="true" className="status-dot" />
      {status.replaceAll('_', ' ')}
    </span>
  );
}
