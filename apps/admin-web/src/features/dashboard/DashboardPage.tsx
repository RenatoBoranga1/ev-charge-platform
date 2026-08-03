import { useQuery } from '@tanstack/react-query';

import { useAdminSession } from '../../auth/session-store';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import { adminDashboardKeys } from '../../services/query-keys';
import { formatCurrency } from '../../utils/format';

interface DashboardResponse {
  generatedAt: string;
  metrics: {
    activeSessions: number;
    completedSessionsThisMonth: number;
    connectedChargePoints: number;
    drivers: number;
    failedCommands: number;
    reconciliationIssues: number;
    revenueThisMonth: string;
    stations: number;
  };
}

export function DashboardPage() {
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const query = useQuery({
    queryFn: ({ signal }) =>
      adminRequest<DashboardResponse>('/v1/admin/dashboard', { signal }),
    queryKey: adminDashboardKeys.all(tenantId),
    refetchInterval: 30_000,
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  const metrics = query.data.metrics;
  return (
    <div className="page">
      <PageHeader
        eyebrow="Centro de controle"
        subtitle={`Atualizado em ${new Date(query.data.generatedAt).toLocaleTimeString('pt-BR')}. Dados financeiros liquidados e operacionais do tenant atual.`}
        title="Visão geral operacional"
      />
      <section aria-label="Indicadores principais" className="metric-grid">
        <MetricCard icon="⚡" label="Estações" value={metrics.stations} hint={`${metrics.connectedChargePoints} carregadores conectados`} />
        <MetricCard icon="◉" label="Sessões ativas" value={metrics.activeSessions} />
        <MetricCard icon="✓" label="Concluídas no mês" value={metrics.completedSessionsThisMonth} />
        <MetricCard icon="♙" label="Motoristas" value={metrics.drivers} />
        <MetricCard icon="R$" label="Valor liquidado" value={formatCurrency(metrics.revenueThisMonth)} />
        <MetricCard icon="!" label="Divergências" value={metrics.reconciliationIssues} hint={`${metrics.failedCommands} comandos com falha`} />
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <h2>Saúde operacional</h2>
          <div className="health-bar" aria-label={`${metrics.connectedChargePoints} charge points conectados`}>
            <span style={{ width: metrics.stations ? `${Math.min(100, metrics.connectedChargePoints / metrics.stations * 100)}%` : '0%' }} />
          </div>
          <p>Conectividade em tempo real é conciliada com a fonte persistida; eventos não substituem a leitura atual.</p>
        </article>
        <article className="panel panel-solar">
          <h2>Atenção necessária</h2>
          <strong>{metrics.reconciliationIssues + metrics.failedCommands}</strong>
          <p>itens aguardam revisão operacional.</p>
        </article>
      </section>
    </div>
  );
}
