import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAdminSession } from '../../auth/session-store';
import { DataTable, type DataColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import {
  formatDateTime,
  formatMinorCurrency,
  truncateId,
} from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface ReconciliationResult {
  locked: boolean;
  mismatches: number;
  processed: number;
}

interface ReconciliationRow {
  checkedAt: string;
  id: string;
  localAmountMinor: string;
  localStatus: string;
  paymentIntent: {
    currency: string;
    id: string;
    provider: string;
    providerReference: string | null;
    status: string;
    user: { email: string; name: string };
  };
  providerAmountMinor: string | null;
  providerStatus: string | null;
  status: string;
}

export function ReconciliationPage() {
  const tenantId = useAdminSession(
    (state) => state.session?.membership.tenantId ?? '',
  );
  const list = useAdminList<ReconciliationRow>(
    'reconciliation',
    '/v1/admin/reconciliation',
  );
  const queryClient = useQueryClient();
  const reconcile = useMutation({
    mutationFn: () =>
      adminRequest<ReconciliationResult>('/v1/admin/reconciliation/run', {
        method: 'POST',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', tenantId, 'reconciliation'],
      });
    },
  });
  const columns: DataColumn<ReconciliationRow>[] = [
    {
      cell: (row) => (
        <>
          <strong>{truncateId(row.paymentIntent.id)}</strong>
          <small className="cell-subtitle">
            {formatDateTime(row.checkedAt)}
          </small>
        </>
      ),
      header: 'Pagamento',
      key: 'payment',
    },
    {
      cell: (row) => row.paymentIntent.user.email,
      header: 'Motorista',
      key: 'driver',
    },
    {
      cell: (row) => (
        <>
          <strong>
            {formatMinorCurrency(
              row.localAmountMinor,
              row.paymentIntent.currency,
            )}
          </strong>
          <small className="cell-subtitle">{row.localStatus}</small>
        </>
      ),
      header: 'Local',
      key: 'local',
    },
    {
      cell: (row) => (
        <>
          <strong>
            {row.providerAmountMinor
              ? formatMinorCurrency(
                  row.providerAmountMinor,
                  row.paymentIntent.currency,
                )
              : '—'}
          </strong>
          <small className="cell-subtitle">
            {row.providerStatus ?? 'sem retorno'}
          </small>
        </>
      ),
      header: 'Provedor',
      key: 'provider',
    },
    {
      cell: (row) => <StatusBadge status={row.status} />,
      header: 'Resultado',
      key: 'status',
    },
  ];

  return (
    <div className="page">
      <PageHeader
        subtitle="A execução é protegida por lock e limitada aos pagamentos do tenant atual."
        title="Conciliação financeira"
      />
      <section className="panel reconciliation-panel">
        <h2>Verificação sob demanda</h2>
        <p>
          Compara estados locais elegíveis com o provedor configurado e cria
          registros imutáveis para divergências.
        </p>
        <button
          className="button button-primary"
          disabled={reconcile.isPending}
          onClick={() => reconcile.mutate()}
          type="button"
        >
          {reconcile.isPending ? 'Conciliando…' : 'Executar conciliação'}
        </button>
        {reconcile.data ? (
          <div className="result-card" role="status">
            <StatusBadge
              status={
                reconcile.data.locked
                  ? 'LOCKED'
                  : reconcile.data.mismatches
                    ? 'REQUIRES_REVIEW'
                    : 'MATCHED'
              }
            />
            <strong>{reconcile.data.processed} processados</strong>
            <span>{reconcile.data.mismatches} divergências</span>
          </div>
        ) : null}
        {reconcile.isError ? (
          <ErrorState message={reconcile.error.message} />
        ) : null}
      </section>

      <section aria-labelledby="reconciliation-history-title">
        <h2 id="reconciliation-history-title">Histórico de verificações</h2>
        {list.query.isPending ? <LoadingState /> : null}
        {list.query.isError ? (
          <ErrorState
            message={list.query.error.message}
            onRetry={() => void list.query.refetch()}
          />
        ) : null}
        {list.query.data?.data.length ? (
          <DataTable
            caption="Conciliações do tenant atual"
            columns={columns}
            rows={list.query.data.data}
          />
        ) : null}
      </section>
    </div>
  );
}