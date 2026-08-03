import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useAdminSession } from '../../auth/session-store';
import { DataTable, type DataColumn } from '../../components/DataTable';
import { FilterBar } from '../../components/ListControls';
import { PageHeader } from '../../components/PageHeader';
import { ReasonDialog } from '../../components/ReasonDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import { formatDateTime } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface DriverRow {
  blockedAt: string | null;
  email: string;
  id: string;
  isBlocked: boolean;
  name: string;
  phone: string | null;
}

export function DriversPage() {
  const list = useAdminList<DriverRow>('drivers', '/v1/admin/drivers');
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const canBlock = useAdminSession((state) => state.hasPermission('drivers.block'));
  const canUnblock = useAdminSession((state) => state.hasPermission('drivers.unblock'));
  const [target, setTarget] = useState<DriverRow | null>(null);
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: ({ driver, reason }: { driver: DriverRow; reason: string }) =>
      adminRequest(`/v1/admin/drivers/${driver.id}/${driver.isBlocked ? 'unblock' : 'block'}`, {
        body: JSON.stringify({ reason }),
        method: 'POST',
      }),
    onSuccess: async () => {
      setTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'drivers'] });
    },
  });
  const columns: DataColumn<DriverRow>[] = [
    { cell: (row) => <><strong>{row.name}</strong><small className="cell-subtitle">{row.email}</small></>, header: 'Motorista', key: 'name' },
    { cell: (row) => row.phone ?? '—', header: 'Contato', key: 'phone' },
    { cell: (row) => <StatusBadge status={row.isBlocked ? 'BLOCKED' : 'ACTIVE'} />, header: 'Acesso', key: 'status' },
    { cell: (row) => formatDateTime(row.blockedAt), header: 'Bloqueado em', key: 'blockedAt' },
    {
      cell: (row) => ((row.isBlocked && canUnblock) || (!row.isBlocked && canBlock))
        ? <button className="button button-small" onClick={() => setTarget(row)} type="button">{row.isBlocked ? 'Desbloquear' : 'Bloquear'}</button>
        : '—',
      header: 'Ação',
      key: 'action',
    },
  ];
  return (
    <div className="page">
      <PageHeader subtitle="Bloqueios revogam refresh tokens ativos e ficam registrados na auditoria." title="Motoristas" />
      <FilterBar onSearch={(value) => list.updateFilter('search', value)} onStatus={() => undefined} search={list.search} status="" />
      {action.isError ? <ErrorState message={action.error.message} /> : null}
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length ? <DataTable caption="Motoristas do tenant atual" columns={columns} rows={list.query.data.data} /> : null}
      <ReasonDialog
        busy={action.isPending}
        confirmLabel={target?.isBlocked ? 'Desbloquear motorista' : 'Bloquear motorista'}
        description={target?.isBlocked ? 'O motorista poderá criar uma nova sessão após autenticar novamente.' : 'Sessões de autenticação serão revogadas imediatamente.'}
        onCancel={() => setTarget(null)}
        onConfirm={(reason) => target && void action.mutateAsync({ driver: target, reason })}
        open={Boolean(target)}
        title={`${target?.isBlocked ? 'Desbloquear' : 'Bloquear'} ${target?.name ?? ''}`}
      />
    </div>
  );
}
