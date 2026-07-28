import { tokenStorage } from '@/auth/token-storage';
import { createRestApiClients } from '@/api/rest-api';
import { mockProfile, mockVehicles } from '@/mocks/data';

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
    text: jest.fn().mockResolvedValue(
      body === undefined ? '' : JSON.stringify(body),
    ),
  } as unknown as Response;
}

describe('REST profile and vehicles API', () => {
  const fetchMock = jest.fn();
  const api = createRestApiClients('http://localhost:8000/');

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue('access-token');
  });

  it('updates the profile and requests account deletion with record versions', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ ...mockProfile, firstName: 'Ana' }))
      .mockResolvedValueOnce(
        response({
          ...mockProfile,
          accountDeletionRequestedAt: '2026-07-28T10:00:00.000Z',
        }),
      );

    await api.users.update({
      firstName: 'Ana',
      recordVersion: 1,
    });
    await api.users.requestDeletion(2);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/v1/users/me',
      expect.objectContaining({
        body: JSON.stringify({ firstName: 'Ana', recordVersion: 1 }),
        method: 'PATCH',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8000/v1/users/me',
      expect.objectContaining({
        body: JSON.stringify({ recordVersion: 2 }),
        method: 'DELETE',
      }),
    );
  });

  it('maps listing filters and the complete vehicle CRUD endpoints', async () => {
    const vehicle = mockVehicles[0]!;
    fetchMock
      .mockResolvedValueOnce(response([vehicle]))
      .mockResolvedValueOnce(response(vehicle))
      .mockResolvedValueOnce(response(vehicle, 201))
      .mockResolvedValueOnce(response({ ...vehicle, color: 'Preto' }))
      .mockResolvedValueOnce(response({ ...vehicle, isDefault: true }))
      .mockResolvedValueOnce(response({ ...vehicle, id: 'copy' }, 201))
      .mockResolvedValueOnce(response(undefined, 204));

    await api.vehicles.list({
      search: 'aurora',
      sortBy: 'nickname',
      sortOrder: 'asc',
      status: 'ACTIVE',
      type: 'BEV',
    });
    await api.vehicles.getById(vehicle.id);
    await api.vehicles.create({
      batteryCapacityKwh: 64,
      brand: 'Aurora',
      isDefault: false,
      model: 'E1',
      nickname: 'Aurora',
      status: 'ACTIVE',
      supportedPlugTypes: ['CCS2'],
      vehicleType: 'BEV',
    });
    await api.vehicles.update(vehicle.id, {
      color: 'Preto',
      recordVersion: vehicle.recordVersion,
    });
    await api.vehicles.setDefault(vehicle.id, vehicle.recordVersion);
    await api.vehicles.duplicate(vehicle.id, vehicle.recordVersion);
    await api.vehicles.remove(vehicle.id, vehicle.recordVersion);

    const listUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(listUrl).toContain('/v1/users/me/vehicles?');
    expect(listUrl).toContain('search=aurora');
    expect(listUrl).toContain('type=BEV');
    expect(listUrl).toContain('status=ACTIVE');
    expect(listUrl).toContain('sortBy=nickname');
    expect(listUrl).toContain('sortOrder=asc');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `http://localhost:8000/v1/users/me/vehicles/${vehicle.id}`,
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'http://localhost:8000/v1/users/me/vehicles',
    );
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      `http://localhost:8000/v1/users/me/vehicles/${vehicle.id}/default`,
    );
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      `http://localhost:8000/v1/users/me/vehicles/${vehicle.id}/duplicate`,
    );
    expect(fetchMock.mock.calls[6]?.[1]).toEqual(
      expect.objectContaining({ method: 'DELETE' }),
    );
    for (const call of fetchMock.mock.calls) {
      const headers = new Headers(call[1]?.headers);
      expect(headers.get('Authorization')).toBe('Bearer access-token');
    }
  });

  it('omits the query delimiter for an unfiltered vehicle list', async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    await api.vehicles.list();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/v1/users/me/vehicles',
      expect.any(Object),
    );
  });
});
