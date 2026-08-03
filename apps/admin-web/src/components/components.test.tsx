import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DataTable } from './DataTable';
import { ErrorState, LoadingState, EmptyState, PermissionDeniedState } from './States';
import { StatusBadge } from './StatusBadge';

describe('administrative components', () => {
  it('communicates status with text and a semantic visual marker', () => {
    render(<StatusBadge status="OFFLINE" />);
    expect(screen.getByText('OFFLINE')).toBeVisible();
    expect(screen.getByText('OFFLINE')).toHaveClass('status-negative');
  });

  it('renders an accessible table caption and headers', () => {
    render(
      <MemoryRouter>
        <DataTable
          caption="Estações do tenant"
          columns={[{ cell: (row) => row.name, header: 'Nome', key: 'name' }]}
          rows={[{ id: 'station-1', name: 'Solis Centro' }]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('table', { name: 'Estações do tenant' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeVisible();
    expect(screen.getByText('Solis Centro')).toBeVisible();
  });
  it('covers every status tone and accessible operational state', () => {
    const retry = vi.fn();
    render(
      <>
        <StatusBadge status="ACTIVE" />
        <StatusBadge status="PENDING" />
        <StatusBadge status="UNKNOWN" />
        <LoadingState />
        <EmptyState message="Sem dados" />
        <ErrorState message="Falha" onRetry={retry} />
        <PermissionDeniedState />
      </>,
    );
    expect(screen.getByText('ACTIVE')).toHaveClass('status-positive');
    expect(screen.getByText('PENDING')).toHaveClass('status-warning');
    expect(screen.getByText('UNKNOWN')).toHaveClass('status-neutral');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sem dados')).toBeVisible();
  });
});
