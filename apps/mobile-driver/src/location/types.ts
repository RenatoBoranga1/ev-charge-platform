export type LocationPermissionStatus =
  | 'not-requested'
  | 'granted'
  | 'denied'
  | 'blocked';

export type LocationPrecision = 'precise' | 'approximate' | 'unknown';

export interface LocationPermissionState {
  status: LocationPermissionStatus;
  precision: LocationPrecision;
  canAskAgain: boolean;
}

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: number;
}

export type LocationErrorCode =
  | 'permission-denied'
  | 'permission-blocked'
  | 'services-disabled'
  | 'unavailable'
  | 'timeout'
  | 'cancelled'
  | 'network-error'
  | 'native-error';

export interface LocationFailure {
  code: LocationErrorCode;
  message: string;
  recoverable: boolean;
}

export type LocationResult =
  | {
      ok: true;
      coordinates: UserCoordinates;
      precision: LocationPrecision;
    }
  | {
      ok: false;
      error: LocationFailure;
    };

export interface LocationWatchHandle {
  stop: () => void;
}

export type LocationWatchResult =
  | { ok: true; handle: LocationWatchHandle }
  | { ok: false; error: LocationFailure };
