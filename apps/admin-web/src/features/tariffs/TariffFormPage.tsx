import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAdminSession } from '../../auth/session-store';
import { PageHeader } from '../../components/PageHeader';
import { adminRequest } from '../../services/api';

const tariffSchema = z.object({
  activationFee: z.number().min(0),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  parkingFeeHour: z.number().min(0),
  pricePerKwh: z.number().min(0),
  stationId: z.uuid('Informe o UUID da estação.'),
  validFrom: z.string().optional(),
});
type TariffForm = z.infer<typeof tariffSchema>;

export function TariffFormPage() {
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TariffForm>({
    defaultValues: { activationFee: 0, currency: 'BRL', parkingFeeHour: 0 },
    resolver: zodResolver(tariffSchema),
  });
  const create = useMutation({
    mutationFn: (values: TariffForm) =>
      adminRequest('/v1/admin/tariffs', {
        body: JSON.stringify(values),
        method: 'POST',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'tariffs'] });
      await navigate('/admin/tariffs', { replace: true });
    },
  });

  return (
    <div className="page page-narrow">
      <PageHeader subtitle="O rascunho poderá ser revisado antes da publicação. Sessões manterão seu snapshot histórico." title="Criar tarifa" />
      <form className="form-panel" onSubmit={(event) => void handleSubmit((values) => create.mutateAsync(values))(event)} noValidate>
        <div className="form-grid">
          <label>Nome<input {...register('name')} />{errors.name ? <span className="field-error">{errors.name.message}</span> : null}</label>
          <label>Estação (UUID)<input {...register('stationId')} />{errors.stationId ? <span className="field-error">{errors.stationId.message}</span> : null}</label>
          <label>Moeda<input maxLength={3} {...register('currency')} />{errors.currency ? <span className="field-error">{errors.currency.message}</span> : null}</label>
          <label>Preço por kWh<input min="0" step="0.0001" type="number" {...register('pricePerKwh', { valueAsNumber: true })} /></label>
          <label>Taxa de ativação<input min="0" step="0.01" type="number" {...register('activationFee', { valueAsNumber: true })} /></label>
          <label>Estacionamento/hora<input min="0" step="0.01" type="number" {...register('parkingFeeHour', { valueAsNumber: true })} /></label>
          <label>Início da vigência<input type="datetime-local" {...register('validFrom')} /></label>
        </div>
        {create.isError ? <div className="form-error" role="alert">{create.error.message}</div> : null}
        <div className="form-actions">
          <button className="button button-quiet" onClick={() => void navigate(-1)} type="button">Cancelar</button>
          <button className="button button-primary" disabled={create.isPending} type="submit">{create.isPending ? 'Criando…' : 'Criar rascunho'}</button>
        </div>
      </form>
    </div>
  );
}
