import type { AdminSession } from '@solis/admin-contracts';

import {
  resetAdminSessionForTests,
  useAdminSession,
} from './session-store';

const session: AdminSession = {
  accessToken: 'access',
  expiresInSeconds: 900,
  membership: {
    id: 'membership-1',
    name: 'Operador',
    permissions: ['stations.read', 'sessions.remote_stop'],
    roles: ['STATION_OPERATOR'],
    tenantId: 'tenant-1',
    tenantName: 'Solis',
  },
};

describe('admin session store', () => {
  beforeEach(resetAdminSessionForTests);

  it('keeps the access session in memory and resolves permissions', () => {
    useAdminSession.getState().setSession(session);
    expect(useAdminSession.getState().initialized).toBe(true);
    expect(useAdminSession.getState().hasPermission('stations.read')).toBe(true);
    expect(useAdminSession.getState().hasPermission('payments.refund')).toBe(false);
    expect(useAdminSession.getState().hasRole('STATION_OPERATOR')).toBe(true);
    expect(useAdminSession.getState().hasRole('TENANT_ADMIN')).toBe(false);
  });

  it('clears all credential state on logout or expiration', () => {
    useAdminSession.getState().setSession(session);
    useAdminSession.getState().clear();
    expect(useAdminSession.getState().session).toBeNull();
    expect(useAdminSession.getState().initialized).toBe(true);
  });
});
