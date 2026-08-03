import { useMutation } from '@tanstack/react-query';

import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState } from '../../components/States';
import { adminRequest } from '../../services/api';

interface ReconciliationResult {
  locked: boolean;
  mismatches: number;
  processed: number;
}

export function ReconciliationPage() {
  const reconcile = useMutation({
    mutationFn: () => adminRequest<ReconciliationResult>('/v1/admin/reconciliation/run', { method: 'POST' }),
  });
  return (
    <div className="page page-narrow">
      <PageHeader subtitle="A execução é protegida por lock e limitada aos pagamentos do tenant atual." title="Conciliação financeira" />
      <section className="panel reconciliation-panel">
        <h2>Verificação sob demanda</h2>
        <p>Compara estados locais elegíveis com o provedor configurado e cria registros imutáveis para divergências.</p>
        <button className="button button-primary" disabled={reconcile.isPending} onClick={() => reconcile.mutate()} type="button">
          {reconcile.isPending ? 'Conciliando…' : 'Executar conciliação'}
        </button>
        {reconcile.data ? (
          <div className="result-card" role="status">
            <StatusBadge status={reconcile.data.locked ? 'LOCKED' : reconcile.data.mismatches ? 'REQUIRES_REVIEW' : 'MATCHED'} />
            <strong>{reconcile.data.processed} processados</strong>
            <span>{reconcile.data.mismatches} divergências</span>
          </div>
        ) : null}
        {reconcile.isError ? <ErrorState message={reconcile.error.message} /> : null}
      </section>
    </div>
  );
}
