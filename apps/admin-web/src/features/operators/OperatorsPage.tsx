import { zodResolver } from '@hookform/resolvers/zod';
import { adminRoles, type AdminRole } from '@solis/admin-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAdminSession } from '../../auth/session-store';
import { DataTable, type DataColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../components/States';
import { adminRequest } from '../../services/api';
import { formatDateTime } from '../../utils/format';
import { useAdminList } from '../shared/use-admin-list';

interface OperatorRow {
  createdAt: string;
  displayName: string;
  email: string;
  id: string;
  roleAssignments: Array<{ role: AdminRole }>;
  status: string;
}
const inviteSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  name: z.string().trim().min(2).max(120),
  role: z.enum(adminRoles),
});
type InviteForm = z.infer<typeof inviteSchema>;

export function OperatorsPage() {
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const canInvite = useAdminSession((state) => state.hasPermission('users.invite'));
  const list = useAdminList<OperatorRow>('operators', '/v1/admin/operators');
  const queryClient = useQueryClient();
  const { formState: { errors }, handleSubmit, register, reset } = useForm<InviteForm>({
    defaultValues: { role: 'VIEWER' },
    resolver: zodResolver(inviteSchema),
  });
  const invite = useMutation({
    mutationFn: (values: InviteForm) =>
      adminRequest('/v1/admin/operators/invite', {
        body: JSON.stringify({ email: values.email, name: values.name, roles: [values.role] }),
        method: 'POST',
      }),
    onSuccess: async () => {
      reset({ email: '', name: '', role: 'VIEWER' });
      await queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'operators'] });
    },
  });
  const columns: DataColumn<OperatorRow>[] = [
    { cell: (row) => <><strong>{row.displayName}</strong><small className="cell-subtitle">{row.email}</small></>, header: 'Operador', key: 'operator' },
    { cell: (row) => row.roleAssignments.map(({ role }) => role.replaceAll('_', ' ')).join(', '), header: 'Papéis', key: 'roles' },
    { cell: (row) => <StatusBadge status={row.status} />, header: 'Status', key: 'status' },
    { cell: (row) => formatDateTime(row.createdAt), header: 'Criado em', key: 'created' },
  ];
  return (
    <div className="page">
      <PageHeader subtitle="Papéis são resolvidos por membership e tenant; não existem privilégios globais implícitos." title="Operadores e permissões" />
      {canInvite ? (
        <section className="form-panel command-form">
          <h2>Convidar operador</h2>
          <form onSubmit={(event) => void handleSubmit((values) => invite.mutateAsync(values))(event)}>
            <label>Nome<input {...register('name')} />{errors.name ? <span className="field-error">{errors.name.message}</span> : null}</label>
            <label>E-mail<input type="email" {...register('email')} />{errors.email ? <span className="field-error">{errors.email.message}</span> : null}</label>
            <label>Papel<select {...register('role')}>{adminRoles.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</select></label>
            <button className="button button-primary" disabled={invite.isPending} type="submit">Enviar convite</button>
          </form>
          {invite.isError ? <ErrorState message={invite.error.message} /> : null}
        </section>
      ) : null}
      {list.query.isPending ? <LoadingState /> : null}
      {list.query.isError ? <ErrorState message={list.query.error.message} onRetry={() => void list.query.refetch()} /> : null}
      {list.query.data?.data.length ? <DataTable caption="Operadores do tenant atual" columns={columns} rows={list.query.data.data} /> : null}
    </div>
  );
}
