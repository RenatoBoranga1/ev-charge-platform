import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAdminSession } from '../../auth/session-store';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';

interface MapStation {
  availableConnectors: number;
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  status: string;
  totalConnectors: number;
}

export function MapPage() {
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const query = useQuery({
    queryFn: ({ signal }) => adminRequest<MapStation[]>('/v1/admin/map', { signal }),
    queryKey: ['admin', tenantId, 'map'],
    refetchInterval: 30_000,
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  return (
    <div className="page">
      <PageHeader subtitle="Visão geográfica simplificada com alternativa integral em lista acessível." title="Mapa operacional" />
      <div className="map-layout">
        <section className="map-panel" aria-label="Representação geográfica das estações">
          <div className="map-grid" aria-hidden="true" />
          {query.data.map((station, index) => (
            <Link
              aria-label={`${station.name}, ${station.status}, ${station.availableConnectors} conectores disponíveis`}
              className={`map-pin map-pin-${station.status.toLowerCase()}`}
              key={station.id}
              style={{
                left: `${15 + (index * 23) % 72}%`,
                top: `${18 + (index * 29) % 62}%`,
              }}
              to={`/admin/stations/${station.id}`}
            >
              ⚡<span>{station.name}</span>
            </Link>
          ))}
        </section>
        <section className="map-list" aria-label="Lista de estações do mapa">
          <h2>Estações visíveis</h2>
          {query.data.map((station) => (
            <article key={station.id}>
              <div><strong>{station.name}</strong><StatusBadge status={station.status} /></div>
              <p>{station.latitude.toFixed(5)}, {station.longitude.toFixed(5)}</p>
              <span>{station.availableConnectors} de {station.totalConnectors} conectores disponíveis</span>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
