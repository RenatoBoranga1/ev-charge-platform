import { createRestApiClients } from '@/api/rest-api';
import { tokenStorage } from '@/auth/token-storage';

jest.mock('@/auth/token-storage', () => ({
  tokenStorage: {
    clearTokens: jest.fn(),
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
  },
}));
jest.mock('@/logging/AppLogger', () => ({
  AppLogger: { error: jest.fn(), warn: jest.fn() },
}));

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('REST dashboard and history API', () => {
  const fetchMock = jest.fn();
  const api = createRestApiClients('http://localhost:8000/');

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue('access-token');
  });

  it('serializes dashboard period, timezone and vehicle without a trailing delimiter', async () => {
    const controller = new AbortController();
    fetchMock
      .mockResolvedValueOnce(response({ summary: {} }))
      .mockResolvedValueOnce(response({ summary: {} }));

    await api.dashboard.get(
      {
        from: '2026-07-01T03:00:00.000Z',
        timezone: 'America/Sao_Paulo',
        to: '2026-07-28T12:00:00.000Z',
        vehicleId: 'vehicle-1',
      },
      controller.signal,
    );
    await api.dashboard.get();

    const dashboardUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(dashboardUrl.pathname).toBe('/v1/users/me/dashboard');
    expect(Object.fromEntries(dashboardUrl.searchParams)).toEqual({
      from: '2026-07-01T03:00:00.000Z',
      timezone: 'America/Sao_Paulo',
      to: '2026-07-28T12:00:00.000Z',
      vehicleId: 'vehicle-1',
    });
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:8000/v1/users/me/dashboard');
  });

  it('maps every history filter and the opaque cursor', async () => {
    fetchMock.mockResolvedValueOnce(response({ items: [], pageInfo: {} }));

    await api.history.list(
      {
        completedOnly: true,
        connectorType: 'CCS2',
        failuresOnly: false,
        from: '2026-07-01T00:00:00.000Z',
        limit: 25,
        search: 'Centro',
        sort: 'COST_DESC',
        stationId: 'station-1',
        status: 'completed',
        timezone: 'America/Sao_Paulo',
        to: '2026-07-31T23:59:59.999Z',
        vehicleId: 'vehicle-1',
        withCost: true,
      },
      'signed.cursor/value',
    );

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/v1/users/me/charging-sessions');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      completedOnly: 'true',
      connectorType: 'CCS2',
      cursor: 'signed.cursor/value',
      failuresOnly: 'false',
      limit: '25',
      search: 'Centro',
      sort: 'COST_DESC',
      stationId: 'station-1',
      status: 'COMPLETED',
      vehicleId: 'vehicle-1',
      withCost: 'true',
    });
  });

  it('uses the driver-scoped detail, timeline and downsampled metrics endpoints', async () => {
    const controller = new AbortController();
    fetchMock
      .mockResolvedValueOnce(response({ id: 'session-1' }))
      .mockResolvedValueOnce(response({ events: [], sessionId: 'session-1' }))
      .mockResolvedValueOnce(response({ points: [], sessionId: 'session-1' }));

    await api.history.getDetails('session-1', controller.signal);
    await api.history.getTimeline('session-1');
    await api.history.getMetrics('session-1', 120);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:8000/v1/users/me/charging-sessions/session-1',
      'http://localhost:8000/v1/users/me/charging-sessions/session-1/timeline',
      'http://localhost:8000/v1/users/me/charging-sessions/session-1/metrics?maxPoints=120',
    ]);
    for (const call of fetchMock.mock.calls) {
      const headers = new Headers(call[1]?.headers);
      expect(headers.get('Authorization')).toBe('Bearer access-token');
    }
  });
});
