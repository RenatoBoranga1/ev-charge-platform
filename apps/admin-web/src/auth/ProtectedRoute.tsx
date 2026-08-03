import type { AdminPermission } from '@solis/admin-contracts';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { LoadingState, PermissionDeniedState } from '../components/States';
import { useAdminSession } from './session-store';

export function ProtectedRoute({
  children,
  permission,
}: PropsWithChildren<{ permission?: AdminPermission }>) {
  const initialized = useAdminSession((state) => state.initialized);
  const session = useAdminSession((state) => state.session);
  const hasPermission = useAdminSession((state) => state.hasPermission);
  const location = useLocation();
  if (!initialized) return <LoadingState label="Restaurando sessão segura" />;
  if (!session) {
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to="/login"
      />
    );
  }
  if (permission && !hasPermission(permission)) return <PermissionDeniedState />;
  return children;
}
