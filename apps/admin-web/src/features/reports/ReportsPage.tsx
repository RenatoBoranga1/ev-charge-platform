import { useState } from 'react';

import { PageHeader } from '../../components/PageHeader';
import { downloadAdminReport } from '../../services/api';

export function ReportsPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const blob = await downloadAdminReport('/v1/admin/reports/charging-sessions.csv');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'solis-charging-sessions.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao exportar relatório.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader subtitle="Exportações respeitam tenant, limite operacional e autorização do operador." title="Relatórios" />
      <article className="panel report-card">
        <span className="report-icon" aria-hidden="true">CSV</span>
        <div>
          <h2>Sessões de recarga</h2>
          <p>Até 10.000 sessões com estação, conector, motorista, energia, valor e timestamps.</p>
          <button className="button button-primary" disabled={busy} onClick={() => void download()} type="button">
            {busy ? 'Preparando…' : 'Exportar CSV'}
          </button>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      </article>
    </div>
  );
}
