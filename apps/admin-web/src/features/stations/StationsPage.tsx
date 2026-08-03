import { Link } from 'react-router-dom';

import { useAdminSession } from '../../auth/session-store';
import { DataTable, type DataColumn } from '../../components/DataTable';
import { FilterBar, Pagination } from '../../components/ListControls';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { truncateId } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface StationRow {
  _count: { chargePoints: number; chargingSessions: number };
  city: string;
  id: string;
  name: string;
  operator: { name: string };
  state: string;
  status: string;
}

const columns: DataColumn<StationRow>[] = [
  {
    cell: (row) => <Link to={`/admin/stations/${row.id}`}><strong>{row.name}</strong><small className="cell-subtitle">{truncateId(row.id)}</small></Link>,
    header: 'Estação',
    key: 'station',
  },
  { cell: (row) => `${row.city}/${row.state}`, header: 'Local', key: 'city' },
  { cell: (row) => row.operator.name, header: 'Operador', key: 'operator' },
  { cell: (row) => row._count.chargePoints, header: 'Charge points', key: 'chargePoints' },
  { cell: (row) => row._count.chargingSessions, header: 'Sessões', key: 'sessions' },
  { cell: (row) => <StatusBadge status={row.status} />, header: 'Status', key: 'status' },
];

export function StationsPage() {
  const list = useAdminList<StationRow>('stations', '/v1/admin/stations');
  const canCreate = useAdminSession((state) => state.hasPermission('stations.create'));
  return (
    <div className="page">
      <PageHeader
        actions={canCreate ? <Link className="button button-primary" to="/admin/stations/new">Nova estação</Link> : undefined}
        subtitle="Cadastre, consulte e arquive locais de recarga sem perder o histórico operacional."
        title="Estações"
      />
      <FilterBar
        onSearch={(value) => list.updateFilter('search', value)}
        onStatus={(value) => list.updateFilter('status', value)}
        search={list.search}
        status={list.status}
        statusOptions={['AVAILABLE', 'PARTIAL', 'OCCUPIED', 'OFFLINE', 'MAINTENANCE']}
      />
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length === 0 ? <EmptyState message="Ajuste os filtros ou cadastre uma estação." /> : null}
      {list.query.data?.data.length ? <DataTable caption="Estações do tenant atual" columns={columns} rows={list.query.data.data} /> : null}
      <Pagination
        canGoBack={Boolean(list.cursor)}
        nextCursor={list.query.data?.nextCursor ?? null}
        onBack={() => list.setCursor('')}
        onNext={list.setCursor}
      />
    </div>
  );
}
