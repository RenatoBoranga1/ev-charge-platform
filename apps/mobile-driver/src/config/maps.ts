import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppEnvironment =
  | 'development'
  | 'test'
  | 'staging'
  | 'production';
export type MapProviderName = 'google' | 'platform';
export type SupportedMapPlatform = 'android' | 'ios';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapRuntimeConfig {
  provider: MapProviderName;
  environment: AppEnvironment;
  androidConfigured: boolean;
  iosConfigured: boolean;
  fallbackRegion: MapRegion;
}

export interface MapAvailability {
  available: boolean;
  warning: boolean;
  reason: 'configured' | 'missing-android-key' | 'missing-ios-key';
}

const defaultFallbackRegion: MapRegion = {
  latitude: -23.55052,
  longitude: -46.633308,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

const finiteNumber = (
  value: unknown,
  fallback: number,
  label: string,
): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Configuração de mapa inválida: ${label}.`);
  }
  return parsed;
};

export function parseMapProvider(value: unknown): MapProviderName {
  if (value === undefined || value === null || value === '') return 'platform';
  if (value === 'google' || value === 'platform') return value;
  throw new Error('EXPO_PUBLIC_MAP_PROVIDER deve ser "google" ou "platform".');
}

export function parseAppEnvironment(value: unknown): AppEnvironment {
  if (value === undefined || value === null || value === '') {
    return 'development';
  }
  if (
    value === 'development' ||
    value === 'test' ||
    value === 'staging' ||
    value === 'production'
  ) {
    return value;
  }
  throw new Error('EXPO_PUBLIC_APP_ENV possui valor inválido.');
}

export function createMapRuntimeConfig(
  raw: Readonly<Record<string, unknown>> = {},
  environment: PublicEnvironment = process.env,
): MapRuntimeConfig {
  const fallback = (raw.fallbackRegion ?? {}) as Readonly<
    Record<string, unknown>
  >;

  return {
    provider: parseMapProvider(
      raw.provider ?? environment.EXPO_PUBLIC_MAP_PROVIDER,
    ),
    environment: parseAppEnvironment(
      raw.environment ?? environment.EXPO_PUBLIC_APP_ENV,
    ),
    androidConfigured: raw.androidConfigured === true,
    iosConfigured: raw.iosConfigured === true,
    fallbackRegion: {
      latitude: finiteNumber(
        fallback.latitude ?? environment.EXPO_PUBLIC_MAP_DEFAULT_LATITUDE,
        defaultFallbackRegion.latitude,
        'latitude',
      ),
      longitude: finiteNumber(
        fallback.longitude ?? environment.EXPO_PUBLIC_MAP_DEFAULT_LONGITUDE,
        defaultFallbackRegion.longitude,
        'longitude',
      ),
      latitudeDelta: finiteNumber(
        fallback.latitudeDelta ??
          environment.EXPO_PUBLIC_MAP_DEFAULT_LATITUDE_DELTA,
        defaultFallbackRegion.latitudeDelta,
        'latitudeDelta',
      ),
      longitudeDelta: finiteNumber(
        fallback.longitudeDelta ??
          environment.EXPO_PUBLIC_MAP_DEFAULT_LONGITUDE_DELTA,
        defaultFallbackRegion.longitudeDelta,
        'longitudeDelta',
      ),
    },
  };
}

export function getMapRuntimeConfig(): MapRuntimeConfig {
  const extra = Constants.expoConfig?.extra;
  const rawMaps =
    extra && typeof extra.maps === 'object' && extra.maps !== null
      ? (extra.maps as Readonly<Record<string, unknown>>)
      : {};
  return createMapRuntimeConfig(rawMaps);
}

export function getMapAvailability(
  config: MapRuntimeConfig,
  platform: SupportedMapPlatform,
): MapAvailability {
  if (platform === 'ios' && config.provider === 'platform') {
    return { available: true, warning: false, reason: 'configured' };
  }

  const missingReason =
    platform === 'android' ? 'missing-android-key' : 'missing-ios-key';
  const configured =
    platform === 'android'
      ? config.androidConfigured
      : config.iosConfigured;
  if (configured) {
    return { available: true, warning: false, reason: 'configured' };
  }

  const isNonProduction =
    config.environment === 'development' || config.environment === 'test';
  return {
    available: isNonProduction,
    warning: isNonProduction,
    reason: missingReason,
  };
}

export function getCurrentMapAvailability(
  config = getMapRuntimeConfig(),
): MapAvailability {
  const platform: SupportedMapPlatform =
    Platform.OS === 'ios' ? 'ios' : 'android';
  return getMapAvailability(config, platform);
}
