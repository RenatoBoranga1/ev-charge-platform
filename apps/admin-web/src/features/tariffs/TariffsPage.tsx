import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAdminSession } from '../../auth/session-store';
import { DataTable, type DataColumn } from '../../components/DataTable';
import { FilterBar, Pagination } from '../../components/ListControls';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface TariffRow {
  currency: string;
  id: string;
  name: string;
  pricePerKwh: string;
  publicationStatus: string;
  station: { id: string; name: string };
  validFrom: string;
}

export function TariffsPage() {
  const list = useAdminList<TariffRow>('tariffs', '/v1/admin/tariffs');
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const canCreate = useAdminSession((state) => state.hasPermission('tariffs.create'));
  const canPublish = useAdminSession((state) => state.hasPermission('tariffs.publish'));
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: (id: string) => adminRequest(`/v1/admin/tariffs/${id}/publish`, { method: 'POST' }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'tariffs'] }),
  });
  const columns: DataColumn<TariffRow>[] = [
    { cell: (row) => <strong>{row.name}</strong>, header: 'Tarifa', key: 'name' },
    { cell: (row) => <Link to={`/admin/stations/${row.station.id}`}>{row.station.name}</Link>, header: 'Estação', key: 'station' },
    { cell: (row) => `${formatCurrency(row.pricePerKwh, row.currency)}/kWh`, header: 'Preço', key: 'price' },
    { cell: (row) => formatDateTime(row.validFrom), header: 'Vigência', key: 'validFrom' },
    { cell: (row) => <StatusBadge status={row.publicationStatus} />, header: 'Status', key: 'status' },
    {
      cell: (row) => row.publicationStatus === 'DRAFT' && canPublish
        ? <button className="button button-small" disabled={publish.isPending} onClick={() => void publish.mutateAsync(row.id)} type="button">Publicar</button>
        : '—',
      header: 'Ação',
      key: 'action',
    },
  ];
  return (
    <div className="page">
      <PageHeader actions={canCreate ? <Link className="button button-primary" to="/admin/tariffs/new">Nova tarifa</Link> : undefined} subtitle="Tarifas publicadas são imutáveis; alterações futuras geram versões auditáveis." title="Tarifas" />
      <FilterBar onSearch={() => undefined} onStatus={(value) => list.updateFilter('status', value)} search="" status={list.status} statusOptions={['DRAFT', 'PUBLISHED', 'ARCHIVED']} />
      {publish.isError ? <ErrorState message={publish.error.message} /> : null}
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length === 0 ? <EmptyState message="Nenhuma tarifa corresponde ao filtro." /> : null}
      {list.query.data?.data.length ? <DataTable caption="Tarifas do tenant atual" columns={columns} rows={list.query.data.data} /> : null}
      <Pagination canGoBack={Boolean(list.cursor)} nextCursor={list.query.data?.nextCursor ?? null} onBack={() => list.setCursor('')} onNext={list.setCursor} />
    </div>
  );
}
