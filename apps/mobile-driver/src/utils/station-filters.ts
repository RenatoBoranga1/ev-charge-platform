import type { Station, StationFilters } from '@/types/domain';

export const defaultStationFilters: StationFilters = {
  availability: [],
  maximumDistanceKm: 50,
  plugTypes: [],
  minimumPowerKw: 0,
  currentTypes: [],
  maximumPricePerKwh: 5,
  open24HoursOnly: false,
  parkingOnly: false,
};

export function filterStations(
  stations: Station[],
  filters: StationFilters,
): Station[] {
  return stations.filter((station) => {
    const hasCurrentType =
      filters.currentTypes.length === 0 ||
      station.connectors.some((connector) =>
        filters.currentTypes.includes(connector.currentType),
      );
    const hasPlug =
      filters.plugTypes.length === 0 ||
      station.plugTypes.some((plug) => filters.plugTypes.includes(plug));

    return (
      (filters.availability.length === 0 ||
        filters.availability.includes(station.status)) &&
      station.distanceKm <= filters.maximumDistanceKm &&
      station.maximumPowerKw >= filters.minimumPowerKw &&
      station.pricePerKwh <= filters.maximumPricePerKwh &&
      (!filters.open24HoursOnly || station.isOpen24Hours) &&
      (!filters.parkingOnly || station.hasParking) &&
      (!filters.operator || station.operator === filters.operator) &&
      hasCurrentType &&
      hasPlug
    );
  });
}

export function countActiveFilters(filters: StationFilters): number {
  return [
    filters.availability.length > 0,
    filters.maximumDistanceKm < defaultStationFilters.maximumDistanceKm,
    filters.plugTypes.length > 0,
    filters.minimumPowerKw > 0,
    filters.currentTypes.length > 0,
    filters.maximumPricePerKwh < defaultStationFilters.maximumPricePerKwh,
    filters.open24HoursOnly,
    filters.parkingOnly,
    Boolean(filters.operator),
  ].filter(Boolean).length;
}
