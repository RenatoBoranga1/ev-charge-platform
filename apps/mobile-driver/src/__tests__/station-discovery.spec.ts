import {
  discoverStations,
  formatDistance,
  hasValidStationCoordinates,
  haversineDistanceKm,
  matchesStationSearch,
  sanitizeStationSearch,
  sortStations,
} from '@/stations/discovery';
import type { Station } from '@/types/domain';
import { defaultStationFilters } from '@/utils/station-filters';

const station = (overrides: Partial<Station> = {}): Station => ({
  id: 'station-a',
  name: 'Estação Sé',
  address: 'Praça da Sé, São Paulo',
  latitude: -23.5505,
  longitude: -46.6333,
  distanceKm: 0,
  availableConnectors: 2,
  totalConnectors: 4,
  maximumPowerKw: 150,
  plugTypes: ['CCS2'],
  pricePerKwh: 2.1,
  rating: 4.7,
  openingHours: '24 horas',
  isOpen24Hours: true,
  hasParking: true,
  operator: 'Rede Solis',
  status: 'AVAILABLE',
  connectors: [
    {
      id: 'connector-a',
      code: 'SOLIS-001',
      number: 1,
      plugType: 'CCS2',
      currentType: 'DC',
      maximumPowerKw: 150,
      status: 'AVAILABLE',
    },
  ],
  ...overrides,
});

describe('station discovery', () => {
  it('sanitizes control characters, whitespace and excessive input', () => {
    const result = sanitizeStationSearch(`  Sé\u0000   ${'x'.repeat(200)} `);
    expect(result).not.toMatch(/[\u0000-\u001F]/);
    expect(result).not.toContain('  ');
    expect(result).toHaveLength(120);
  });

  it('matches accents and all supported station metadata', () => {
    const target = station();
    expect(matchesStationSearch(target, 'estacao se')).toBe(true);
    expect(matchesStationSearch(target, 'sao paulo')).toBe(true);
    expect(matchesStationSearch(target, 'solis-001')).toBe(true);
    expect(matchesStationSearch(target, 'rede solis')).toBe(true);
    expect(matchesStationSearch(target, 'chademo')).toBe(false);
    expect(matchesStationSearch(target, '')).toBe(true);
  });

  it('calculates and formats geographic distance', () => {
    expect(
      haversineDistanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeCloseTo(111.2, 1);
    expect(formatDistance(-1)).toBe('1 m');
    expect(formatDistance(0.42)).toBe('420 m');
    expect(formatDistance(4.25)).toBe('4.3 km');
    expect(formatDistance(12.4)).toBe('12 km');
  });

  it('rejects coordinates that cannot be rendered safely', () => {
    expect(hasValidStationCoordinates(station())).toBe(true);
    expect(
      hasValidStationCoordinates(station({ latitude: Number.NaN })),
    ).toBe(false);
    expect(hasValidStationCoordinates(station({ latitude: 91 }))).toBe(false);
    expect(hasValidStationCoordinates(station({ longitude: 181 }))).toBe(false);
  });

  it.each([
    ['distance', ['near', 'far']],
    ['availability', ['available', 'offline']],
    ['power', ['fast', 'slow']],
    ['price', ['cheap', 'expensive']],
    ['name', ['alpha', 'zulu']],
  ] as const)('sorts stations by %s', (mode, expected) => {
    const fixtures: Record<string, Station[]> = {
      distance: [
        station({ id: 'far', distanceKm: 8 }),
        station({ id: 'near', distanceKm: 1 }),
      ],
      availability: [
        station({ id: 'offline', status: 'OFFLINE' }),
        station({ id: 'available', status: 'AVAILABLE' }),
      ],
      power: [
        station({ id: 'slow', maximumPowerKw: 22 }),
        station({ id: 'fast', maximumPowerKw: 150 }),
      ],
      price: [
        station({ id: 'expensive', pricePerKwh: 3 }),
        station({ id: 'cheap', pricePerKwh: 1.5 }),
      ],
      name: [
        station({ id: 'zulu', name: 'Zulu' }),
        station({ id: 'alpha', name: 'Alpha' }),
      ],
    };

    expect(sortStations(fixtures[mode]!, mode).map((item) => item.id)).toEqual(
      expected,
    );
  });

    expect(
      sortStations(
        [
          station({ id: 'one', status: 'AVAILABLE', availableConnectors: 1 }),
          station({ id: 'two', status: 'AVAILABLE', availableConnectors: 2 }),
        ],
        'availability',
      ).map((item) => item.id),
    ).toEqual(['two', 'one']);

    expect(
      sortStations(
        [
          station({ id: 'z', name: 'Zulu', maximumPowerKw: 100 }),
          station({ id: 'a', name: 'Alpha', maximumPowerKw: 100 }),
        ],
        'power',
      ).map((item) => item.id),
    ).toEqual(['a', 'z']);
    expect(
      sortStations(
        [
          station({ id: 'z', name: 'Zulu', pricePerKwh: 2 }),
          station({ id: 'a', name: 'Alpha', pricePerKwh: 2 }),
        ],
        'price',
      ).map((item) => item.id),
    ).toEqual(['a', 'z']);
    expect(
      sortStations(
        [
          station({ id: 'z', name: 'Zulu', distanceKm: 2 }),
          station({ id: 'a', name: 'Alpha', distanceKm: 2 }),
        ],
        'distance',
      ).map((item) => item.id),
    ).toEqual(['a', 'z']);
  it('uses one pipeline for location, filters, search and ordering', () => {
    const result = discoverStations(
      [
        station({ id: 'invalid', latitude: Number.NaN }),
        station({ id: 'slow', name: 'Shopping', maximumPowerKw: 22 }),
        station({ id: 'fast', name: 'Avenida Paulista', maximumPowerKw: 150 }),
      ],
      {
        filters: { ...defaultStationFilters, minimumPowerKw: 100 },
        origin: { latitude: -23.5505, longitude: -46.6333 },
        searchQuery: 'paulista',
        sortMode: 'distance',
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('fast');
    expect(result[0]?.distanceKm).toBe(0);
  });
});
