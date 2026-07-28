import { createMockApiClients } from '@/api/mock-api';

describe('mock dashboard and history API', () => {
  const api = createMockApiClients();
  const july = {
    from: '2026-07-01T00:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    to: '2026-07-31T23:59:59.999Z',
  };

  it('aggregates only persisted mock sessions and keeps unsupported estimates null', async () => {
    const dashboard = await api.dashboard.get(july);

    expect(dashboard.summary).toMatchObject({
      avoidedCo2Kg: null,
      estimatedSavings: null,
      totalSessions: 1,
    });
    expect(dashboard.lastSession?.station.name).toBe('Solis Centro');
    expect(dashboard.primaryVehicle).not.toBeNull();

    const unknownVehicle = await api.dashboard.get({
      ...july,
      vehicleId: 'other-user-vehicle',
    });
    expect(unknownVehicle.summary.totalSessions).toBe(0);
  });

  it('supports cursor pagination and deterministic ordering', async () => {
    const first = await api.history.list({ limit: 1, sort: 'RECENT' });
    expect(first.items).toHaveLength(1);
    expect(first.pageInfo).toEqual({
      endCursor: 'mock:1',
      hasNextPage: true,
    });

    const second = await api.history.list({ limit: 1, sort: 'RECENT' }, first.pageInfo.endCursor!);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    expect(second.pageInfo.hasNextPage).toBe(false);
  });

  it('applies period, station, connector, status, search and cost filters', async () => {
    const result = await api.history.list({
      ...july,
      completedOnly: true,
      connectorType: 'CCS2',
      search: 'centro',
      sort: 'ENERGY_DESC',
      status: 'completed',
      stationId: 'ef5a80bb-2090-45cb-83cd-bc04fc5e9a01',
      withCost: true,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      cost: { currency: 'BRL' },
      status: 'completed',
    });

    await expect(api.history.list({ sort: 'RECENT' }, 'not-a-valid-mock-cursor')).rejects.toThrow(
      'Cursor',
    );
  });

  it('returns safe details, timeline and metrics without protocol payloads', async () => {
    const page = await api.history.list({ limit: 1, sort: 'RECENT' });
    const sessionId = page.items[0]!.id;
    const [details, timeline, metrics] = await Promise.all([
      api.history.getDetails(sessionId),
      api.history.getTimeline(sessionId),
      api.history.getMetrics(sessionId),
    ]);

    expect(details).toMatchObject({
      id: sessionId,
      audit: { version: 1 },
      station: { latitude: expect.any(Number), longitude: expect.any(Number) },
    });
    expect(details).not.toHaveProperty('ocppPayload');
    expect(timeline.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['created', 'authorized', 'charging_started']),
    );
    expect(metrics).toMatchObject({
      sessionId,
      summary: {
        originalPointCount: 0,
        returnedPointCount: 0,
      },
    });
  });
});
