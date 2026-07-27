import { EmptyState } from './AsyncState';

interface VehicleEmptyStateProps {
  filtered?: boolean;
  onAdd: () => void;
}

export function VehicleEmptyState({
  filtered = false,
  onAdd,
}: VehicleEmptyStateProps) {
  return (
    <EmptyState
      actionLabel={filtered ? 'Limpar filtros' : 'Adicionar veículo'}
      message={filtered ? 'Ajuste a busca ou os filtros.' : 'Cadastre um veículo para personalizar recargas e rotas.'}
      onAction={onAdd}
      title={filtered ? 'Nenhum veículo encontrado' : 'Sua garagem está vazia'}
    />
  );
}
