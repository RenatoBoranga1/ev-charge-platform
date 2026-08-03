import type { AdminSession } from '@solis/admin-contracts';

import {
  adminRequest,
  ApiError,
  loginAdmin,
  refreshAdminSession,
} from './api';
import {
  resetAdminSessionForTests,
  useAdminSession,
} from '../auth/session-store';

const session: AdminSession = {
  accessToken: 'access-new',
  expiresInSeconds: 900,
  membership: {
    id: 'membership-1',
    name: 'Admin',
    permissions: ['stations.read'],
    roles: ['TENANT_ADMIN'],
    tenantId: 'tenant-1',
    tenantName: 'Solis',
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('admin API client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    resetAdminSessionForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'solis_admin_csrf=csrf-token; path=/';
  });

  afterEach(() => vi.unstubAllGlobals());

  it('logs in with credentials and stores only the access session in memory', async () => {
    fetchMock.mockResolvedValue(jsonResponse(session));
    await expect(
      loginAdmin({ email: 'admin@solis.local', password: 'password' }),
    ).resolves.toEqual(session);
    expect(useAdminSession.getState().session).toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith('/v1/admin/auth/login', {
      body: JSON.stringify({
        email: 'admin@solis.local',
        password: 'password',
      }),
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  });

  it('refreshes with the readable CSRF cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse(session));
    await refreshAdminSession();
    const request = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(request?.headers).get('x-csrf-token')).toBe('csrf-token');
    expect(request?.credentials).toBe('include');
  });

  it('refreshes once after an unauthorized access request and retries', async () => {
    useAdminSession.getState().setSession({ ...session, accessToken: 'expired' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse({ stations: 3 }));

    await expect(adminRequest('/v1/admin/dashboard')).resolves.toEqual({
      stations: 3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    expect(retryHeaders.get('authorization')).toBe('Bearer access-new');
  });

  it('returns the standardized backend error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'ADMIN_PERMISSION_DENIED', message: 'Negado' }, 403),
    );
    await expect(adminRequest('/v1/admin/audit')).rejects.toEqual(
      new ApiError(403, 'ADMIN_PERMISSION_DENIED', 'Negado'),
    );
  });
  it('rejects refresh when the CSRF cookie is unavailable', async () => {
    document.cookie = 'solis_admin_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    await expect(refreshAdminSession()).rejects.toEqual(
      new ApiError(401, 'CSRF_COOKIE_MISSING', 'Sessão expirada.'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('joins validation messages and accepts empty successful responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: ['Campo inválido', 'Revise os dados'] }, 400),
    );
    await expect(adminRequest('/v1/admin/stations')).rejects.toMatchObject({
      message: 'Campo inválido Revise os dados',
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(adminRequest('/v1/admin/no-content')).resolves.toBeUndefined();
  });
});
