import * as ExpoLocation from 'expo-location';

import type {
  LocationFailure,
  LocationPermissionState,
  LocationPrecision,
  LocationResult,
  LocationWatchResult,
} from './types';

export interface LocationAdapter {
  getForegroundPermissionsAsync: () => Promise<ExpoLocation.LocationPermissionResponse>;
  requestForegroundPermissionsAsync: () => Promise<ExpoLocation.LocationPermissionResponse>;
  hasServicesEnabledAsync: () => Promise<boolean>;
  getCurrentPositionAsync: (
    options: ExpoLocation.LocationOptions,
  ) => Promise<ExpoLocation.LocationObject>;
  watchPositionAsync: (
    options: ExpoLocation.LocationOptions,
    callback: ExpoLocation.LocationCallback,
  ) => Promise<ExpoLocation.LocationSubscription>;
}

export interface LocationRequestOptions {
  requestPermission?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const failure = (
  code: LocationFailure['code'],
  message: string,
  recoverable: boolean,
): LocationFailure => ({ code, message, recoverable });

const cancelledFailure = (): LocationFailure =>
  failure('cancelled', 'A operação de localização foi cancelada.', true);

const timeoutFailure = (): LocationFailure =>
  failure(
    'timeout',
    'Não foi possível obter sua localização a tempo.',
    true,
  );

function permissionPrecision(
  permission: ExpoLocation.LocationPermissionResponse,
): LocationPrecision {
  if (permission.android?.accuracy === 'fine') return 'precise';
  if (permission.android?.accuracy === 'coarse') return 'approximate';
  if (permission.ios?.accuracy === 'full') return 'precise';
  if (permission.ios?.accuracy === 'reduced') return 'approximate';
  return 'unknown';
}

export function mapLocationPermission(
  permission: ExpoLocation.LocationPermissionResponse,
): LocationPermissionState {
  if (permission.granted) {
    return {
      status: 'granted',
      precision: permissionPrecision(permission),
      canAskAgain: permission.canAskAgain,
    };
  }
  if (permission.status === 'undetermined') {
    return {
      status: 'not-requested',
      precision: 'unknown',
      canAskAgain: permission.canAskAgain,
    };
  }
  return {
    status: permission.canAskAgain ? 'denied' : 'blocked',
    precision: 'unknown',
    canAskAgain: permission.canAskAgain,
  };
}

const toLocationResult = (
  location: ExpoLocation.LocationObject,
  precision: LocationPrecision,
): LocationResult => ({
  ok: true,
  precision,
  coordinates: {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy,
    capturedAt: location.timestamp,
  },
});

export class LocationService {
  constructor(
    private readonly adapter: LocationAdapter = ExpoLocation,
    private readonly defaultTimeoutMs = 12_000,
  ) {}

  async getPermissionState(): Promise<LocationPermissionState> {
    try {
      return mapLocationPermission(
        await this.adapter.getForegroundPermissionsAsync(),
      );
    } catch {
      return {
        status: 'denied',
        precision: 'unknown',
        canAskAgain: true,
      };
    }
  }

  async requestCurrentLocation(
    options: LocationRequestOptions = {},
  ): Promise<LocationResult> {
    if (options.signal?.aborted) {
      return { ok: false, error: cancelledFailure() };
    }

    try {
      const permissionResponse = options.requestPermission
        ? await this.adapter.requestForegroundPermissionsAsync()
        : await this.adapter.getForegroundPermissionsAsync();
      const permission = mapLocationPermission(permissionResponse);
      if (permission.status !== 'granted') {
        const blocked = permission.status === 'blocked';
        return {
          ok: false,
          error: failure(
            blocked ? 'permission-blocked' : 'permission-denied',
            blocked
              ? 'A localização está bloqueada nas configurações do aparelho.'
              : 'Permita a localização para encontrar estações próximas.',
            !blocked,
          ),
        };
      }

      if (!(await this.adapter.hasServicesEnabledAsync())) {
        return {
          ok: false,
          error: failure(
            'services-disabled',
            'Ative o GPS para usar sua localização.',
            true,
          ),
        };
      }

      const controlled = await this.withControls(
        this.adapter.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
        }),
        options.timeoutMs ?? this.defaultTimeoutMs,
        options.signal,
      );
      if (!controlled.ok) return controlled;
      return toLocationResult(controlled.value, permission.precision);
    } catch {
      return {
        ok: false,
        error: failure(
          'native-error',
          'Não foi possível acessar a localização do aparelho.',
          true,
        ),
      };
    }
  }

  async watchLocation(
    onLocation: (result: LocationResult) => void,
    signal?: AbortSignal,
  ): Promise<LocationWatchResult> {
    if (signal?.aborted) {
      return { ok: false, error: cancelledFailure() };
    }

    const permission = await this.getPermissionState();
    if (permission.status !== 'granted') {
      return {
        ok: false,
        error: failure(
          permission.status === 'blocked'
            ? 'permission-blocked'
            : 'permission-denied',
          'A localização em tempo real não está autorizada.',
          permission.status !== 'blocked',
        ),
      };
    }

    try {
      if (!(await this.adapter.hasServicesEnabledAsync())) {
        return {
          ok: false,
          error: failure(
            'services-disabled',
            'Ative o GPS para acompanhar sua posição.',
            true,
          ),
        };
      }

      const subscription = await this.adapter.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 15_000,
        },
        (location) =>
          onLocation(toLocationResult(location, permission.precision)),
      );
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        subscription.remove();
        signal?.removeEventListener('abort', stop);
      };
      signal?.addEventListener('abort', stop, { once: true });
      if (signal?.aborted) stop();
      return { ok: true, handle: { stop } };
    } catch {
      return {
        ok: false,
        error: failure(
          'native-error',
          'Não foi possível acompanhar sua localização.',
          true,
        ),
      };
    }
  }

  private async withControls<T>(
    operation: Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<
    { ok: true; value: T } | { ok: false; error: LocationFailure }
  > {
    if (signal?.aborted) {
      return { ok: false, error: cancelledFailure() };
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (
        result:
          | { ok: true; value: T }
          | { ok: false; error: LocationFailure },
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        resolve(result);
      };
      const cancel = () => finish({ ok: false, error: cancelledFailure() });
      const timer = setTimeout(
        () => finish({ ok: false, error: timeoutFailure() }),
        Math.max(timeoutMs, 1),
      );
      signal?.addEventListener('abort', cancel, { once: true });
      operation.then(
        (value) => finish({ ok: true, value }),
        () =>
          finish({
            ok: false,
            error: failure(
              'unavailable',
              'A localização não está disponível neste aparelho.',
              true,
            ),
          }),
      );
    });
  }
}

export const locationService = new LocationService();
