import type { MapRegion } from '@/config/maps';

export interface ClusterPoint<T> {
  id: string;
  latitude: number;
  longitude: number;
  value: T;
}

export type MarkerCluster<T> =
  | {
      kind: 'point';
      id: string;
      latitude: number;
      longitude: number;
      point: ClusterPoint<T>;
    }
  | {
      kind: 'cluster';
      id: string;
      latitude: number;
      longitude: number;
      points: ClusterPoint<T>[];
    };

const safeDelta = (delta: number): number => Math.max(Math.abs(delta), 0.001);

export function clusterPoints<T>(
  points: ClusterPoint<T>[],
  region: MapRegion,
  cellsPerAxis = 8,
): MarkerCluster<T>[] {
  if (points.length === 0) return [];
  const cellCount = Math.max(2, Math.floor(cellsPerAxis));
  const latitudeCell = safeDelta(region.latitudeDelta) / cellCount;
  const longitudeCell = safeDelta(region.longitudeDelta) / cellCount;
  const buckets = new Map<string, ClusterPoint<T>[]>();

  for (const point of points) {
    const latitudeIndex = Math.floor(
      (point.latitude - (region.latitude - region.latitudeDelta / 2)) /
        latitudeCell,
    );
    const longitudeIndex = Math.floor(
      (point.longitude - (region.longitude - region.longitudeDelta / 2)) /
        longitudeCell,
    );
    const key = `${latitudeIndex}:${longitudeIndex}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(point);
    else buckets.set(key, [point]);
  }

  return [...buckets.values()].map((bucket) => {
    if (bucket.length === 1) {
      const point = bucket[0]!;
      return {
        kind: 'point',
        id: point.id,
        latitude: point.latitude,
        longitude: point.longitude,
        point,
      };
    }

    const sorted = [...bucket].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    return {
      kind: 'cluster',
      id: `cluster:${sorted.map((point) => point.id).join(':')}`,
      latitude:
        sorted.reduce((total, point) => total + point.latitude, 0) /
        sorted.length,
      longitude:
        sorted.reduce((total, point) => total + point.longitude, 0) /
        sorted.length,
      points: sorted,
    };
  });
}
