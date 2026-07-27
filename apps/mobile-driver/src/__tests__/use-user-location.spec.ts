import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { LocationService } from '@/location/LocationService';
import { useUserLocation } from '@/location/useUserLocation';
import type { LocationResult } from '@/location/types';

const coordinates = {
  latitude: -23.55,
  longitude: -46.63,
  accuracyMeters: 10,
  capturedAt: 123,
};

describe('useUserLocation', () => {
  it('does not prompt automatically and disposes an authorized watch', async () => {
    const stop = jest.fn();
    let watchCallback: ((result: LocationResult) => void) | undefined;
    const service = {
      getPermissionState: jest.fn().mockResolvedValue({
        status: 'granted',
        precision: 'precise',
        canAskAgain: true,
      }),
      requestCurrentLocation: jest.fn().mockResolvedValue({
        ok: true,
        precision: 'precise',
        coordinates,
      }),
      watchLocation: jest.fn().mockImplementation(async (callback) => {
        watchCallback = callback;
        return { ok: true, handle: { stop } };
      }),
    } as unknown as LocationService;

    const { result, unmount } = renderHook(() => useUserLocation(service));
    await waitFor(() => expect(result.current.coordinates).toEqual(coordinates));
    expect(service.requestCurrentLocation).toHaveBeenCalledWith(
      expect.objectContaining({ requestPermission: false }),
    );
    expect(service.watchLocation).toHaveBeenCalledTimes(1);

    act(() => {
      watchCallback?.({
        ok: true,
        precision: 'approximate',
        coordinates: { ...coordinates, latitude: -22.9 },
      });
    });
    expect(result.current.coordinates?.latitude).toBe(-22.9);

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    act(() => {
      watchCallback?.({
        ok: true,
        precision: 'precise',
        coordinates,
      });
    });
  });

  it('requests permission only after an explicit action and exposes failures', async () => {
    const service = {
      getPermissionState: jest.fn().mockResolvedValue({
        status: 'denied',
        precision: 'unknown',
        canAskAgain: true,
      }),
      requestCurrentLocation: jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'permission-denied',
          message: 'Permissão necessária.',
          recoverable: true,
        },
      }),
      watchLocation: jest.fn(),
    } as unknown as LocationService;
    const { result } = renderHook(() => useUserLocation(service));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(service.requestCurrentLocation).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(service.requestCurrentLocation).toHaveBeenCalledWith(
      expect.objectContaining({ requestPermission: true }),
    );
    expect(result.current.error?.code).toBe('permission-denied');

    await act(async () => {
      await result.current.refresh();
    });
    expect(service.requestCurrentLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestPermission: false }),
    );
  });
});
