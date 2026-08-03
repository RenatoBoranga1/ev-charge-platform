import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useAdminSession } from '../../auth/session-store';
import { DataTable, type DataColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { ReasonDialog } from '../../components/ReasonDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import { formatDateTime, formatMinorCurrency, truncateId } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface PaymentRow {
  amountMinor: string;
  capturedAmountMinor: string;
  createdAt: string;
  currency: string;
  id: string;
  refundedAmountMinor: string;
  status: string;
  type: string;
  user: { email: string; name: string };
}

export function PaymentsPage() {
  const list = useAdminList<PaymentRow>('payments', '/v1/admin/payments');
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const canRefund = useAdminSession((state) => state.hasPermission('payments.refund'));
  const [target, setTarget] = useState<PaymentRow | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const queryClient = useQueryClient();
  const refund = useMutation({
    mutationFn: ({ payment, reason }: { payment: PaymentRow; reason: string }) =>
      adminRequest(`/v1/admin/payments/${payment.id}/refund`, {
        body: JSON.stringify({ reason }),
        headers: { 'idempotency-key': idempotencyKey.current },
        method: 'POST',
      }),
    onSuccess: async () => {
      idempotencyKey.current = crypto.randomUUID();
      setTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'payments'] });
    },
  });
  const columns: DataColumn<PaymentRow>[] = [
    { cell: (row) => <><strong>{truncateId(row.id)}</strong><small className="cell-subtitle">{formatDateTime(row.createdAt)}</small></>, header: 'Pagamento', key: 'id' },
    { cell: (row) => <><strong>{row.user.name}</strong><small className="cell-subtitle">{row.user.email}</small></>, header: 'Motorista', key: 'driver' },
    { cell: (row) => row.type.replaceAll('_', ' '), header: 'Tipo', key: 'type' },
    { cell: (row) => formatMinorCurrency(row.capturedAmountMinor || row.amountMinor, row.currency), header: 'Capturado', key: 'amount' },
    { cell: (row) => formatMinorCurrency(row.refundedAmountMinor, row.currency), header: 'Estornado', key: 'refund' },
    { cell: (row) => <StatusBadge status={row.status} />, header: 'Status', key: 'status' },
    {
      cell: (row) => canRefund && ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(row.status)
        ? <button className="button button-small" onClick={() => setTarget(row)} type="button">Estornar</button>
        : '—',
      header: 'Ação',
      key: 'action',
    },
  ];
  return (
    <div className="page">
      <PageHeader subtitle="Valores vêm de pagamentos capturados. Estornos usam idempotência e preservam o ledger de partidas dobradas." title="Pagamentos" />
      {refund.isError ? <ErrorState message={refund.error.message} /> : null}
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length ? <DataTable caption="Pagamentos do tenant atual" columns={columns} rows={list.query.data.data} /> : null}
      <ReasonDialog
        busy={refund.isPending}
        confirmLabel="Confirmar estorno"
        description={`O saldo elegível de ${target ? formatMinorCurrency(target.capturedAmountMinor, target.currency) : ''} será devolvido sem editar lançamentos existentes.`}
        onCancel={() => setTarget(null)}
        onConfirm={(reason) => target && void refund.mutateAsync({ payment: target, reason })}
        open={Boolean(target)}
        title="Estorno financeiro"
      />
    </div>
  );
}
