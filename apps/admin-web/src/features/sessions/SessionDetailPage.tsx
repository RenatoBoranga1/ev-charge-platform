import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { useAdminSession } from '../../auth/session-store';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/format';

interface SessionDetail {
  completedAt: string | null;
  connector: { code: string; plugType: string };
  energyKwh: string;
  id: string;
  meterValues: Array<{ energyKwh: string; powerKw: string; sampledAt: string }>;
  startedAt: string | null;
  station: { name: string };
  status: string;
  tariffSnapshot: { currency?: string; pricePerKwh?: number } | null;
  totalAmount: string;
  user: { email: string; name: string };
  vehicle: { brand: string; model: string };
}

export function SessionDetailPage() {
  const { sessionId = '' } = useParams();
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const query = useQuery({
    queryFn: ({ signal }) => adminRequest<SessionDetail>(`/v1/admin/charging-sessions/${sessionId}`, { signal }),
    queryKey: ['admin', tenantId, 'session', sessionId],
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  const session = query.data;
  return (
    <div className="page">
      <PageHeader subtitle={`${session.user.name} · ${session.vehicle.brand} ${session.vehicle.model}`} title={`Sessão ${session.id.slice(0, 8)}`} />
      <section className="detail-metrics">
        <div><span>Status</span><StatusBadge status={session.status} /></div>
        <div><span>Energia</span><strong>{Number(session.energyKwh).toFixed(3)} kWh</strong></div>
        <div><span>Custo</span><strong>{formatCurrency(session.totalAmount)}</strong></div>
        <div><span>Início</span><strong>{formatDateTime(session.startedAt)}</strong></div>
      </section>
      <section className="panel">
        <h2>Timeline de medição</h2>
        <ol className="audit-timeline">
          {session.meterValues.map((value) => (
            <li key={value.sampledAt}>
              <span>{formatDateTime(value.sampledAt)}</span>
              <strong>{Number(value.energyKwh).toFixed(3)} kWh · {Number(value.powerKw).toFixed(1)} kW</strong>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
