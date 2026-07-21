import { tokenStorage } from '@/auth/token-storage';
import { createRestApiClients } from '@/api/rest-api';

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

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('RestChargingApi', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue('access-token');
  });

  it('creates and starts a session with stable idempotency keys', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ id: 'session-1' }, 201))
      .mockResolvedValueOnce(response({ id: 'session-1', status: 'charging' }));

    const api = createRestApiClients('http://localhost:8000');
    await api.charging.start({
      idempotencyKey: 'mobile-create',
      paymentMethodId: 'payment-1',
      validatedConnector: {
        connector: { id: 'connector-1' },
      },
      vehicleId: 'vehicle-1',
    } as never);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/v1/charging-sessions',
      expect.objectContaining({
        body: JSON.stringify({
          connectorId: 'connector-1',
          paymentMethodId: 'payment-1',
          vehicleId: 'vehicle-1',
        }),
        method: 'POST',
      }),
    );
    const createHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const startHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(createHeaders.get('Idempotency-Key')).toBe('mobile-create');
    expect(startHeaders.get('Idempotency-Key')).toBe('mobile-create:start');
    expect(startHeaders.get('Authorization')).toBe('Bearer access-token');
  });

  it('reads metrics and sends an idempotent stop', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ sessionId: 'session-1' }))
      .mockResolvedValueOnce(response({ session: { id: 'session-1' } }));

    const charging = createRestApiClients('http://localhost:8000').charging;
    await charging.getMetrics('session-1');
    await charging.stop('session-1', 'mobile-stop');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:8000/v1/charging-sessions/session-1/metrics',
    );
    const stopHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(stopHeaders.get('Idempotency-Key')).toBe('mobile-stop');
  });
});
