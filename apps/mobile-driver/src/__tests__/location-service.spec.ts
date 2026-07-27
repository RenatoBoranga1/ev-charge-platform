import type * as ExpoLocation from 'expo-location';

import {
  LocationService,
  mapLocationPermission,
  type LocationAdapter,
} from '@/location/LocationService';

const grantedPermission = (
  overrides: Partial<ExpoLocation.LocationPermissionResponse> = {},
): ExpoLocation.LocationPermissionResponse =>
  ({
    canAskAgain: true,
    expires: 'never',
    granted: true,
    status: 'granted',
    android: { accuracy: 'fine' },
    ...overrides,
  }) as ExpoLocation.LocationPermissionResponse;

const deniedPermission = (
  canAskAgain: boolean,
): ExpoLocation.LocationPermissionResponse =>
  ({
    canAskAgain,
    expires: 'never',
    granted: false,
    status: 'denied',
  }) as ExpoLocation.LocationPermissionResponse;

const position = {
  coords: {
    latitude: -23.55,
    longitude: -46.63,
    altitude: null,
    accuracy: 12,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1234,
} as ExpoLocation.LocationObject;

function adapter(
  overrides: Partial<LocationAdapter> = {},
): LocationAdapter {
  return {
    getForegroundPermissionsAsync: jest
      .fn()
      .mockResolvedValue(grantedPermission()),
    requestForegroundPermissionsAsync: jest
      .fn()
      .mockResolvedValue(grantedPermission()),
    hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
    getCurrentPositionAsync: jest.fn().mockResolvedValue(position),
    watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    ...overrides,
  };
}

describe('LocationService', () => {
  it('maps native permission states and precision', () => {
    expect(mapLocationPermission(grantedPermission())).toMatchObject({
      status: 'granted',
      precision: 'precise',
    });
    expect(
      mapLocationPermission(
        grantedPermission({ android: { accuracy: 'coarse' } }),
      ),
    ).toMatchObject({ precision: 'approximate' });
    expect(
      mapLocationPermission({
        ...grantedPermission(),
        android: undefined,
        ios: { accuracy: 'reduced', scope: 'whenInUse' },
      } as unknown as ExpoLocation.LocationPermissionResponse),
    ).toMatchObject({ precision: 'approximate' });
    expect(
      mapLocationPermission({
        ...grantedPermission(),
        android: undefined,
        ios: { accuracy: 'full', scope: 'whenInUse' },
      } as unknown as ExpoLocation.LocationPermissionResponse),
    ).toMatchObject({ precision: 'precise' });
    expect(
      mapLocationPermission({
        ...grantedPermission(),
        android: undefined,
        ios: undefined,
      } as unknown as ExpoLocation.LocationPermissionResponse),
    ).toMatchObject({ precision: 'unknown' });
    expect(
      mapLocationPermission({
        ...deniedPermission(true),
        status: 'undetermined',
      } as unknown as ExpoLocation.LocationPermissionResponse),
    ).toMatchObject({ status: 'not-requested' });
    expect(mapLocationPermission(deniedPermission(true))).toMatchObject({
      status: 'denied',
    });
    expect(mapLocationPermission(deniedPermission(false))).toMatchObject({
      status: 'blocked',
    });
  });

  it('gets a balanced current position after explicit permission', async () => {
    const locationAdapter = adapter();
    const result = await new LocationService(
      locationAdapter,
    ).requestCurrentLocation({ requestPermission: true });

    expect(result).toEqual({
      ok: true,
      precision: 'precise',
      coordinates: {
        latitude: -23.55,
        longitude: -46.63,
        accuracyMeters: 12,
        capturedAt: 1234,
      },
    });
    expect(
      locationAdapter.requestForegroundPermissionsAsync,
    ).toHaveBeenCalledTimes(1);
    expect(locationAdapter.getCurrentPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mayShowUserSettingsDialog: false }),
    );
  });

  it.each([
    [deniedPermission(true), 'permission-denied', true],
    [deniedPermission(false), 'permission-blocked', false],
  ] as const)(
    'reports denied and blocked permissions',
    async (permission, code, recoverable) => {
      const result = await new LocationService(
        adapter({
          getForegroundPermissionsAsync: jest
            .fn()
            .mockResolvedValue(permission),
        }),
      ).requestCurrentLocation();
      expect(result).toMatchObject({
        ok: false,
        error: { code, recoverable },
      });
    },
  );

  it('reports disabled location services', async () => {
    const result = await new LocationService(
      adapter({
        hasServicesEnabledAsync: jest.fn().mockResolvedValue(false),
      }),
    ).requestCurrentLocation();
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'services-disabled' },
    });
  });

  it('supports timeout, cancellation and native failures', async () => {
    const timeoutResult = await new LocationService(
      adapter({
        getCurrentPositionAsync: jest
          .fn()
          .mockReturnValue(new Promise(() => undefined)),
      }),
      1,
    ).requestCurrentLocation();
    expect(timeoutResult).toMatchObject({
      ok: false,
      error: { code: 'timeout' },
    });

    const aborted = new AbortController();
    aborted.abort();
    await expect(
      new LocationService(adapter()).requestCurrentLocation({
        signal: aborted.signal,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'cancelled' },
    });

    let resolvePermission!: (
      permission: ExpoLocation.LocationPermissionResponse,
    ) => void;
    const permissionPromise =
      new Promise<ExpoLocation.LocationPermissionResponse>((resolve) => {
        resolvePermission = resolve;
      });
    const abortDuringPermission = new AbortController();
    const pending = new LocationService(
      adapter({
        getForegroundPermissionsAsync: jest
          .fn()
          .mockReturnValue(permissionPromise),
      }),
    ).requestCurrentLocation({ signal: abortDuringPermission.signal });
    abortDuringPermission.abort();
    resolvePermission(grantedPermission());
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'cancelled' },
    });

    const inFlightController = new AbortController();
    const cancelledInFlight = new LocationService(
      adapter({
        getCurrentPositionAsync: jest
          .fn()
          .mockReturnValue(new Promise(() => undefined)),
      }),
    ).requestCurrentLocation({
      signal: inFlightController.signal,
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    inFlightController.abort();
    await expect(cancelledInFlight).resolves.toMatchObject({
      ok: false,
      error: { code: 'cancelled' },
    });

    const unavailable = await new LocationService(
      adapter({
        getCurrentPositionAsync: jest
          .fn()
          .mockRejectedValue(new Error('provider unavailable')),
      }),
    ).requestCurrentLocation();
    expect(unavailable).toMatchObject({
      ok: false,
      error: { code: 'unavailable' },
    });

    const nativeFailure = await new LocationService(
      adapter({
        getForegroundPermissionsAsync: jest
          .fn()
          .mockRejectedValue(new Error('native')),
      }),
    ).requestCurrentLocation();
    expect(nativeFailure).toMatchObject({
      ok: false,
      error: { code: 'native-error' },
    });
  });

  it('starts a cancellable watch and removes the native subscription once', async () => {
    const remove = jest.fn();
    let nativeCallback: ExpoLocation.LocationCallback | undefined;
    const controller = new AbortController();
    const service = new LocationService(
      adapter({
        watchPositionAsync: jest.fn(async (_options, callback) => {
          nativeCallback = callback;
          return { remove };
        }),
      }),
    );
    const onLocation = jest.fn();
    const result = await service.watchLocation(
      onLocation,
      controller.signal,
    );
    expect(result.ok).toBe(true);
    nativeCallback?.(position);
    expect(onLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        coordinates: expect.objectContaining({ latitude: -23.55 }),
      }),
    );
    controller.abort();
    if (result.ok) result.handle.stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('rejects watch when cancelled, unauthorized, disabled or unavailable', async () => {
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(
      new LocationService(adapter()).watchLocation(
        jest.fn(),
        alreadyAborted.signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'cancelled' },
    });
    await expect(
      new LocationService(
        adapter({
          getForegroundPermissionsAsync: jest
            .fn()
            .mockResolvedValue(deniedPermission(false)),
        }),
      ).watchLocation(jest.fn()),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'permission-blocked' },
    });
    await expect(
      new LocationService(
        adapter({
          hasServicesEnabledAsync: jest.fn().mockResolvedValue(false),
        }),
      ).watchLocation(jest.fn()),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'services-disabled' },
    });
    await expect(
      new LocationService(
        adapter({
          watchPositionAsync: jest.fn().mockRejectedValue(new Error('native')),
        }),
      ).watchLocation(jest.fn()),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'native-error' },
    });
  });

  it('returns a conservative permission state when native inspection fails', async () => {
    const result = await new LocationService(
      adapter({
        getForegroundPermissionsAsync: jest
          .fn()
          .mockRejectedValue(new Error('native')),
      }),
    ).getPermissionState();
    expect(result).toEqual({
      status: 'denied',
      precision: 'unknown',
      canAskAgain: true,
    });
  });
});
