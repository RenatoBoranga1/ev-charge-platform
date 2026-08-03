import { zodResolver } from '@hookform/resolvers/zod';
import { supportedRemoteCommandTypes } from '@solis/admin-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAdminSession } from '../../auth/session-store';
import { DataTable, type DataColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import { formatDateTime, truncateId } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface CommandRow {
  completedAt: string | null;
  createdAt: string;
  id: string;
  reason: string;
  status: string;
  type: string;
}

const commandSchema = z.object({
  chargingSessionId: z.uuid('Informe o UUID da sessão.'),
  reason: z.string().trim().min(8, 'Descreva o motivo operacional.').max(500),
  type: z.enum(supportedRemoteCommandTypes),
});
type CommandForm = z.infer<typeof commandSchema>;

const columns: DataColumn<CommandRow>[] = [
  { cell: (row) => <><strong>{truncateId(row.id)}</strong><small className="cell-subtitle">{formatDateTime(row.createdAt)}</small></>, header: 'Comando', key: 'id' },
  { cell: (row) => row.type.replaceAll('_', ' '), header: 'Tipo', key: 'type' },
  { cell: (row) => row.reason, header: 'Justificativa', key: 'reason' },
  { cell: (row) => <StatusBadge status={row.status} />, header: 'Resultado real', key: 'status' },
  { cell: (row) => formatDateTime(row.completedAt), header: 'Conclusão', key: 'completed' },
];

export function CommandsPage() {
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const list = useAdminList<CommandRow>('commands', '/v1/admin/remote-commands');
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CommandForm>({
    defaultValues: { type: 'REMOTE_STOP' },
    resolver: zodResolver(commandSchema),
  });
  const create = useMutation({
    mutationFn: (values: CommandForm) =>
      adminRequest('/v1/admin/remote-commands', {
        body: JSON.stringify(values),
        headers: { 'idempotency-key': idempotencyKey.current },
        method: 'POST',
      }),
    onSuccess: async () => {
      idempotencyKey.current = crypto.randomUUID();
      reset({ chargingSessionId: '', reason: '', type: 'REMOTE_STOP' });
      await queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'commands'] });
    },
  });
  return (
    <div className="page">
      <PageHeader subtitle="O envio não é tratado como aceitação. O resultado persistido e auditado é a fonte de verdade." title="Comandos remotos" />
      <section className="form-panel command-form" aria-labelledby="new-command">
        <h2 id="new-command">Novo comando suportado</h2>
        <form onSubmit={(event) => void handleSubmit((values) => create.mutateAsync(values))(event)}>
          <label>Tipo<select {...register('type')}>{supportedRemoteCommandTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
          <label>Sessão de recarga<input {...register('chargingSessionId')} />{errors.chargingSessionId ? <span className="field-error">{errors.chargingSessionId.message}</span> : null}</label>
          <label className="form-wide">Justificativa<textarea rows={3} {...register('reason')} />{errors.reason ? <span className="field-error">{errors.reason.message}</span> : null}</label>
          <button className="button button-danger" disabled={create.isPending} type="submit">{create.isPending ? 'Enviando…' : 'Confirmar comando'}</button>
        </form>
        {create.isError ? <div className="form-error" role="alert">{create.error.message}</div> : null}
      </section>
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length ? <DataTable caption="Histórico de comandos remotos" columns={columns} rows={list.query.data.data} /> : null}
    </div>
  );
}
