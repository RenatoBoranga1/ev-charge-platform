import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAdminSession } from '../../auth/session-store';
import { PageHeader } from '../../components/PageHeader';
import { adminRequest } from '../../services/api';

const stationSchema = z.object({
  address: z.string().trim().min(2, 'Informe o endereço.').max(160),
  city: z.string().trim().min(2, 'Informe a cidade.').max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().trim().min(2, 'Informe o nome.').max(120),
  operatorId: z.uuid('Informe o UUID do operador de rede.'),
  postalCode: z.string().trim().max(20).optional(),
  state: z.string().trim().min(2, 'Informe o estado.').max(40),
});
type StationForm = z.infer<typeof stationSchema>;

export function StationFormPage() {
  const tenantId = useAdminSession((state) => state.session?.membership.tenantId ?? '');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<StationForm>({ resolver: zodResolver(stationSchema) });
  const create = useMutation({
    mutationFn: (values: StationForm) =>
      adminRequest<{ id: string }>('/v1/admin/stations', {
        body: JSON.stringify(values),
        method: 'POST',
      }),
    onSuccess: async (station) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', tenantId, 'stations'] });
      await navigate(`/admin/stations/${station.id}`, { replace: true });
    },
  });

  return (
    <div className="page page-narrow">
      <PageHeader subtitle="Coordenadas são validadas e persistidas também como geography PostGIS." title="Cadastrar estação" />
      <form className="form-panel" onSubmit={(event) => void handleSubmit((values) => create.mutateAsync(values))(event)} noValidate>
        <div className="form-grid">
          <label>Nome<input {...register('name')} />{errors.name ? <span className="field-error">{errors.name.message}</span> : null}</label>
          <label>Operador (UUID)<input {...register('operatorId')} />{errors.operatorId ? <span className="field-error">{errors.operatorId.message}</span> : null}</label>
          <label className="form-wide">Endereço<input {...register('address')} />{errors.address ? <span className="field-error">{errors.address.message}</span> : null}</label>
          <label>Cidade<input {...register('city')} />{errors.city ? <span className="field-error">{errors.city.message}</span> : null}</label>
          <label>Estado<input {...register('state')} />{errors.state ? <span className="field-error">{errors.state.message}</span> : null}</label>
          <label>CEP<input {...register('postalCode')} /></label>
          <label>Latitude<input inputMode="decimal" type="number" step="any" {...register('latitude', { valueAsNumber: true })} />{errors.latitude ? <span className="field-error">{errors.latitude.message}</span> : null}</label>
          <label>Longitude<input inputMode="decimal" type="number" step="any" {...register('longitude', { valueAsNumber: true })} />{errors.longitude ? <span className="field-error">{errors.longitude.message}</span> : null}</label>
        </div>
        {create.isError ? <div className="form-error" role="alert">{create.error.message}</div> : null}
        <div className="form-actions">
          <button className="button button-quiet" onClick={() => void navigate(-1)} type="button">Cancelar</button>
          <button className="button button-primary" disabled={create.isPending} type="submit">{create.isPending ? 'Salvando…' : 'Cadastrar estação'}</button>
        </div>
      </form>
    </div>
  );
}
