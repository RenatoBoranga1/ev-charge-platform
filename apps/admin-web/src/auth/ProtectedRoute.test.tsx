import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { resetAdminSessionForTests, useAdminSession } from './session-store';
import { ProtectedRoute } from './ProtectedRoute';

describe('ProtectedRoute', () => {
  beforeEach(resetAdminSessionForTests);

  it('shows a permission denied state for insufficient roles', () => {
    useAdminSession.getState().setSession({
      accessToken: 'access',
      expiresInSeconds: 900,
      membership: {
        id: 'membership',
        name: 'Viewer',
        permissions: ['stations.read'],
        roles: ['VIEWER'],
        tenantId: 'tenant',
        tenantName: 'Solis',
      },
    });
    render(
      <MemoryRouter>
        <ProtectedRoute permission="payments.refund">
          <span>Conteúdo financeiro</span>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText('Acesso não autorizado')).toBeVisible();
    expect(screen.queryByText('Conteúdo financeiro')).not.toBeInTheDocument();
  });

  it('renders authorized content', () => {
    useAdminSession.getState().setSession({
      accessToken: 'access',
      expiresInSeconds: 900,
      membership: {
        id: 'membership',
        name: 'Financeiro',
        permissions: ['payments.refund'],
        roles: ['FINANCE_ANALYST'],
        tenantId: 'tenant',
        tenantName: 'Solis',
      },
    });
    render(
      <MemoryRouter>
        <ProtectedRoute permission="payments.refund">
          <span>Conteúdo financeiro</span>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText('Conteúdo financeiro')).toBeVisible();
  });
  it('shows loading while restoring a session', () => {
    render(
      <MemoryRouter>
        <ProtectedRoute><span>Protegido</span></ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Restaurando sessão segura');
  });

  it('redirects an initialized anonymous session to login', () => {
    useAdminSession.getState().clear();
    render(
      <MemoryRouter initialEntries={['/admin/stations']}>
        <Routes>
          <Route path="/admin/stations" element={<ProtectedRoute><span>Protegido</span></ProtectedRoute>} />
          <Route path="/login" element={<span>Tela de login</span>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Tela de login')).toBeVisible();
  });
});
