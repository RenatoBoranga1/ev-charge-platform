import { clusterPoints } from '@/stations/clustering';

const region = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 1,
  longitudeDelta: 1,
};

describe('station clustering', () => {
  it('returns no marker when there are no points', () => {
    expect(clusterPoints([], region)).toEqual([]);
  });

  it('keeps isolated points and groups nearby points deterministically', () => {
    const result = clusterPoints(
      [
        { id: 'b', latitude: 0.01, longitude: 0.01, value: 'B' },
        { id: 'a', latitude: 0, longitude: 0, value: 'A' },
        { id: 'c', latitude: 0.45, longitude: 0.45, value: 'C' },
      ],
      region,
      4,
    );

    const cluster = result.find((item) => item.kind === 'cluster');
    const point = result.find((item) => item.kind === 'point');
    expect(cluster).toMatchObject({
      kind: 'cluster',
      id: 'cluster:a:b',
      latitude: 0.005,
      longitude: 0.005,
    });
    expect(cluster?.kind === 'cluster' && cluster.points.map((item) => item.id))
      .toEqual(['a', 'b']);
    expect(point?.id).toBe('c');
  });

  it('normalizes invalid cell counts and tiny map deltas', () => {
    expect(
      clusterPoints(
        [{ id: 'a', latitude: 0, longitude: 0, value: true }],
        { ...region, latitudeDelta: 0, longitudeDelta: 0 },
        -1,
      ),
    ).toEqual([
      expect.objectContaining({ kind: 'point', id: 'a' }),
    ]);
  });
});
