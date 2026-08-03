import type { AdminSession } from '@solis/admin-contracts';

import { useAdminSession } from '../auth/session-store';

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function readCookie(name: string): string | undefined {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined;
}

async function parseError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as
    | { code?: string; error?: string; message?: string | string[] }
    | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(' ')
    : (body?.message ?? 'Não foi possível concluir a operação.');
  return new ApiError(
    response.status,
    body?.code ?? body?.error ?? 'ADMIN_API_ERROR',
    message,
  );
}

let refreshPromise: Promise<AdminSession> | null = null;

export async function refreshAdminSession(): Promise<AdminSession> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const csrf = readCookie('solis_admin_csrf');
    if (!csrf) throw new ApiError(401, 'CSRF_COOKIE_MISSING', 'Sessão expirada.');
    const response = await fetch(`${apiBaseUrl}/v1/admin/auth/refresh`, {
      credentials: 'include',
      headers: { 'x-csrf-token': csrf },
      method: 'POST',
    });
    if (!response.ok) throw await parseError(response);
    const session = (await response.json()) as AdminSession;
    useAdminSession.getState().setSession(session);
    return session;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function loginAdmin(input: {
  email: string;
  password: string;
}): Promise<AdminSession> {
  const response = await fetch(`${apiBaseUrl}/v1/admin/auth/login`, {
    body: JSON.stringify(input),
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw await parseError(response);
  const session = (await response.json()) as AdminSession;
  useAdminSession.getState().setSession(session);
  return session;
}

export async function logoutAdmin(): Promise<void> {
  try {
    await adminRequest('/v1/admin/auth/logout', { method: 'POST' }, false);
  } finally {
    useAdminSession.getState().clear();
  }
}

export async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const token = useAdminSession.getState().session?.accessToken;
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  if (response.status === 401 && token && allowRefresh) {
    try {
      await refreshAdminSession();
      return adminRequest<T>(path, init, false);
    } catch {
      useAdminSession.getState().clear();
    }
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function downloadAdminReport(path: string): Promise<Blob> {
  const token = useAdminSession.getState().session?.accessToken;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw await parseError(response);
  return response.blob();
}
