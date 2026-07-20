import { mockStations } from '@/mocks/data';
import {
  countActiveFilters,
  defaultStationFilters,
  filterStations,
} from '@/utils/station-filters';

describe('station filters', () => {
  it('filters by availability, plug and power', () => {
    const result = filterStations(mockStations, {
      ...defaultStationFilters,
      availability: ['AVAILABLE'],
      plugTypes: ['CCS2'],
      minimumPowerKw: 100,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Solis Centro');
  });

  it('counts semantic filter groups', () => {
    expect(
      countActiveFilters({
        ...defaultStationFilters,
        parkingOnly: true,
        maximumDistanceKm: 10,
        plugTypes: ['TYPE_2'],
      }),
    ).toBe(3);
  });
});
