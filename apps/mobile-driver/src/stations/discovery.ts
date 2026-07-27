import type { Station, StationFilters, StationStatus } from '@/types/domain';
import { filterStations } from '@/utils/station-filters';

export type StationSortMode =
  | 'distance'
  | 'availability'
  | 'power'
  | 'name'
  | 'price';

export type StationViewMode = 'map' | 'list';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export function hasValidStationCoordinates(
  station: Pick<Station, 'latitude' | 'longitude'>,
): boolean {
  return (
    Number.isFinite(station.latitude) &&
    Number.isFinite(station.longitude) &&
    Math.abs(station.latitude) <= 90 &&
    Math.abs(station.longitude) <= 180
  );
}

export interface StationDiscoveryOptions {
  filters: StationFilters;
  origin: GeoCoordinates;
  searchQuery: string;
  sortMode: StationSortMode;
}

const availabilityRank: Record<StationStatus, number> = {
  AVAILABLE: 0,
  PARTIAL: 1,
  RESERVED: 2,
  OCCUPIED: 3,
  MAINTENANCE: 4,
  OFFLINE: 5,
};

export function sanitizeStationSearch(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function comparableText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function matchesStationSearch(
  station: Station,
  rawQuery: string,
): boolean {
  const query = comparableText(sanitizeStationSearch(rawQuery));
  if (!query) return true;

  const searchable = comparableText(
    [
      station.id,
      station.name,
      station.address,
      station.operator,
      ...station.plugTypes,
      ...station.connectors.flatMap((connector) => [
        connector.id,
        connector.code,
        connector.plugType,
      ]),
    ].join(' '),
  );
  return searchable.includes(query);
}

const degreesToRadians = (degrees: number): number =>
  (degrees * Math.PI) / 180;

export function haversineDistanceKm(
  origin: GeoCoordinates,
  destination: GeoCoordinates,
): number {
  const earthRadiusKm = 6371.0088;
  const latitudeDelta = degreesToRadians(
    destination.latitude - origin.latitude,
  );
  const longitudeDelta = degreesToRadians(
    destination.longitude - origin.longitude,
  );
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const normalizedA = Math.min(1, Math.max(0, a));
  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(normalizedA), Math.sqrt(1 - normalizedA))
  );
}

export function formatDistance(distanceKm: number): string {
  const safeDistance = Math.max(0, distanceKm);
  if (safeDistance < 1) {
    return `${Math.max(1, Math.round(safeDistance * 1000))} m`;
  }
  const fractionDigits = safeDistance < 10 ? 1 : 0;
  return `${safeDistance.toFixed(fractionDigits)} km`;
}

export function sortStations(
  stations: Station[],
  sortMode: StationSortMode,
): Station[] {
  return [...stations].sort((left, right) => {
    switch (sortMode) {
      case 'availability': {
        const rank =
          availabilityRank[left.status] - availabilityRank[right.status];
        if (rank !== 0) return rank;
        return right.availableConnectors - left.availableConnectors;
      }
      case 'power':
        return (
          right.maximumPowerKw - left.maximumPowerKw ||
          left.name.localeCompare(right.name, 'pt-BR')
        );
      case 'name':
        return left.name.localeCompare(right.name, 'pt-BR');
      case 'price':
        return (
          left.pricePerKwh - right.pricePerKwh ||
          left.name.localeCompare(right.name, 'pt-BR')
        );
      case 'distance':
      default:
        return (
          left.distanceKm - right.distanceKm ||
          left.name.localeCompare(right.name, 'pt-BR')
        );
    }
  });
}

export function discoverStations(
  stations: Station[],
  options: StationDiscoveryOptions,
): Station[] {
  const withDistance = stations
    .filter(hasValidStationCoordinates)
    .map((station) => ({
      ...station,
      distanceKm: Number(
        haversineDistanceKm(options.origin, {
          latitude: station.latitude,
          longitude: station.longitude,
        }).toFixed(3),
      ),
    }));

  const filtered = filterStations(withDistance, options.filters).filter(
    (station) => matchesStationSearch(station, options.searchQuery),
  );
  return sortStations(filtered, options.sortMode);
}
