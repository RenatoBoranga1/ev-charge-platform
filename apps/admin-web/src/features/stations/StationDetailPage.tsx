import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAdminSession } from '../../auth/session-store';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';

interface Connector {
  code: string;
  currentType: string;
  id: string;
  maximumPowerKw: string;
  plugType: string;
  status: string;
}
interface StationDetail {
  address: string;
  chargePoints: Array<{
    connectionStatus: string;
    evses: Array<{ connectors: Connector[]; id: string; status: string; uid: string }>;
    externalCode: string;
    id: string;
    lastSeenAt: string | null;
    protocol: string;
    status: string;
  }>;
  city: string;
  id: string;
  name: string;
  state: string;
  status: string;
}

export function StationDetailPage() {
  const { stationId = '' } = useParams();
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const canArchive = useAdminSession((state) => state.hasPermission('stations.archive'));
  const [archiveOpen, setArchiveOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: Boolean(stationId),
    queryFn: ({ signal }) => adminRequest<StationDetail>(`/v1/admin/stations/${stationId}`, { signal }),
    queryKey: ['admin', tenantId, 'station', stationId],
  });
  const archive = useMutation({
    mutationFn: () =>
      adminRequest(`/v1/admin/stations/${stationId}`, {
        body: JSON.stringify({ reason: 'Arquivamento confirmado pelo portal administrativo' }),
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'stations'] });
      await navigate('/admin/stations', { replace: true });
    },
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  const station = query.data;
  return (
    <div className="page">
      <PageHeader
        actions={canArchive ? <button className="button button-danger-outline" onClick={() => setArchiveOpen(true)} type="button">Arquivar</button> : undefined}
        subtitle={`${station.address}, ${station.city}/${station.state}`}
        title={station.name}
      />
      <div className="detail-summary"><StatusBadge status={station.status} /><span>{station.chargePoints.length} charge points</span></div>
      <section className="card-grid" aria-label="Hierarquia de recarga">
        {station.chargePoints.map((chargePoint) => (
          <article className="panel" key={chargePoint.id}>
            <header><div><span className="eyebrow">{chargePoint.protocol}</span><h2>{chargePoint.externalCode}</h2></div><StatusBadge status={chargePoint.connectionStatus} /></header>
            <p>Última comunicação: {chargePoint.lastSeenAt ? new Date(chargePoint.lastSeenAt).toLocaleString('pt-BR') : 'sem comunicação'}</p>
            {chargePoint.evses.map((evse) => (
              <div className="evse" key={evse.id}>
                <strong>EVSE {evse.uid}</strong>
                {evse.connectors.map((connector) => (
                  <div className="connector-row" key={connector.id}>
                    <span>{connector.code} · {connector.plugType} · {connector.maximumPowerKw} kW</span>
                    <StatusBadge status={connector.status} />
                  </div>
                ))}
              </div>
            ))}
          </article>
        ))}
      </section>
      <ConfirmationDialog
        busy={archive.isPending}
        confirmLabel="Arquivar estação"
        description="A estação ficará offline e deixará de aparecer para motoristas. O histórico será preservado."
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => void archive.mutateAsync()}
        open={archiveOpen}
        title="Confirmar arquivamento"
      />
    </div>
  );
}
