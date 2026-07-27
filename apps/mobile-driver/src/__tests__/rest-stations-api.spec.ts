import { createRestApiClients } from '@/api/rest-api';
import { tokenStorage } from '@/auth/token-storage';
import { defaultStationFilters } from '@/utils/station-filters';

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

describe('RestStationsApi', () => {
  it('sends the current origin, filters and cancellation signal', async () => {
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue('access-token');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('[]'),
    });
    globalThis.fetch = fetchMock;
    const controller = new AbortController();

    await createRestApiClients(
      'http://localhost:8000',
    ).stations.getNearby(
      {
        ...defaultStationFilters,
        maximumDistanceKm: 25,
        minimumPowerKw: 100,
        maximumPricePerKwh: 2.5,
      },
      {
        latitude: -23.55,
        longitude: -46.63,
        signal: controller.signal,
      },
    );

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/v1/stations/nearby?');
    const query = new URL(url).searchParams;
    expect(query.get('latitude')).toBe('-23.55');
    expect(query.get('longitude')).toBe('-46.63');
    expect(query.get('distanceKm')).toBe('25');
    expect(query.get('minimumPowerKw')).toBe('100');
    expect(query.get('maximumPricePerKwh')).toBe('2.5');
    expect(init.signal).toBe(controller.signal);
  });
});
