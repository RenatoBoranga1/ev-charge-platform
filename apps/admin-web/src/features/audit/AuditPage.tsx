import { DataTable, type DataColumn } from '../../components/DataTable';
import { FilterBar, Pagination } from '../../components/ListControls';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { formatDateTime, truncateId } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface AuditRow {
  action: string;
  actorType: string;
  createdAt: string;
  entityId: string | null;
  entityType: string;
  id: string;
  justification: string | null;
  outcome: string;
  userId: string | null;
}

const columns: DataColumn<AuditRow>[] = [
  { cell: (row) => <><strong>{row.action.replaceAll('_', ' ')}</strong><small className="cell-subtitle">{formatDateTime(row.createdAt)}</small></>, header: 'Evento', key: 'event' },
  { cell: (row) => <>{row.actorType}<small className="cell-subtitle">{row.userId ? truncateId(row.userId) : 'sistema'}</small></>, header: 'Ator', key: 'actor' },
  { cell: (row) => <>{row.entityType}<small className="cell-subtitle">{row.entityId ? truncateId(row.entityId) : '—'}</small></>, header: 'Recurso', key: 'resource' },
  { cell: (row) => row.justification ?? '—', header: 'Justificativa', key: 'reason' },
  { cell: (row) => <StatusBadge status={row.outcome} />, header: 'Resultado', key: 'outcome' },
];

export function AuditPage() {
  const list = useAdminList<AuditRow>('audit', '/v1/admin/audit-logs');
  return (
    <div className="page">
      <PageHeader subtitle="Estados sensíveis são sanitizados; tokens, segredos e dados de cartão nunca entram na trilha." title="Auditoria operacional" />
      <FilterBar onSearch={(value) => list.updateFilter('search', value)} onStatus={() => undefined} search={list.search} status="" />
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length ? <DataTable caption="Trilha de auditoria do tenant" columns={columns} rows={list.query.data.data} /> : null}
      <Pagination canGoBack={Boolean(list.cursor)} nextCursor={list.query.data?.nextCursor ?? null} onBack={() => list.setCursor('')} onNext={list.setCursor} />
    </div>
  );
}
