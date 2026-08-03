import { Link } from 'react-router-dom';

import { DataTable, type DataColumn } from '../../components/DataTable';
import { FilterBar, Pagination } from '../../components/ListControls';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { formatCurrency, formatDateTime, truncateId } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface SessionRow {
  connector: { code: string };
  energyKwh: string;
  id: string;
  startedAt: string | null;
  station: { name: string };
  status: string;
  totalAmount: string;
  user: { email: string; name: string };
  vehicle: { brand: string; model: string };
}

const columns: DataColumn<SessionRow>[] = [
  { cell: (row) => <Link to={`/admin/sessions/${row.id}`}><strong>{truncateId(row.id)}</strong><small className="cell-subtitle">{formatDateTime(row.startedAt)}</small></Link>, header: 'Sessão', key: 'id' },
  { cell: (row) => <><strong>{row.user.name}</strong><small className="cell-subtitle">{row.user.email}</small></>, header: 'Motorista', key: 'driver' },
  { cell: (row) => `${row.vehicle.brand} ${row.vehicle.model}`, header: 'Veículo', key: 'vehicle' },
  { cell: (row) => <>{row.station.name}<small className="cell-subtitle">{row.connector.code}</small></>, header: 'Local', key: 'station' },
  { cell: (row) => `${Number(row.energyKwh).toFixed(3)} kWh`, header: 'Energia', key: 'energy' },
  { cell: (row) => formatCurrency(row.totalAmount), header: 'Custo', key: 'amount' },
  { cell: (row) => <StatusBadge status={row.status} />, header: 'Status', key: 'status' },
];

export function SessionsPage() {
  const list = useAdminList<SessionRow>('sessions', '/v1/admin/charging-sessions');
  return (
    <div className="page">
      <PageHeader subtitle="Acompanhe energia, tarifa histórica e situação financeira sem editar sessões." title="Sessões de recarga" />
      <FilterBar onSearch={() => undefined} onStatus={(value) => list.updateFilter('status', value)} search="" status={list.status} statusOptions={['PENDING', 'AUTHORIZED', 'STARTING', 'CHARGING', 'STOPPING', 'COMPLETED', 'FAILED', 'CANCELLED']} />
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length === 0 ? <EmptyState message="Nenhuma sessão corresponde ao filtro." /> : null}
      {list.query.data?.data.length ? <DataTable caption="Sessões de recarga" columns={columns} rows={list.query.data.data} /> : null}
      <Pagination canGoBack={Boolean(list.cursor)} nextCursor={list.query.data?.nextCursor ?? null} onBack={() => list.setCursor('')} onNext={list.setCursor} />
    </div>
  );
}
