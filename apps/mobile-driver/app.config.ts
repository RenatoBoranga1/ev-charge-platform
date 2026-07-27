import type { ConfigContext, ExpoConfig } from 'expo/config';

type MapProvider = 'google' | 'platform';
type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

const numberFromEnvironment = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid public map region configuration.');
  }
  return parsed;
};

const mapProviderFromEnvironment = (
  value: string | undefined,
): MapProvider => {
  const provider = value ?? 'platform';
  if (provider === 'google' || provider === 'platform') return provider;
  throw new Error('EXPO_PUBLIC_MAP_PROVIDER must be "google" or "platform".');
};

const appEnvironmentFromEnvironment = (
  value: string | undefined,
): AppEnvironment => {
  const environment = value ?? 'development';
  if (
    environment === 'development' ||
    environment === 'test' ||
    environment === 'staging' ||
    environment === 'production'
  ) {
    return environment;
  }
  throw new Error(
    'EXPO_PUBLIC_APP_ENV must be development, test, staging or production.',
  );
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const provider = mapProviderFromEnvironment(
    process.env.EXPO_PUBLIC_MAP_PROVIDER,
  );
  const environment = appEnvironmentFromEnvironment(
    process.env.EXPO_PUBLIC_APP_ENV,
  );
  const androidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const iosApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY?.trim();

  return {
    ...config,
    name: config.name ?? 'Solis Plataformas',
    slug: config.slug ?? 'solis-plataformas',
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(androidApiKey
          ? { googleMaps: { apiKey: androidApiKey } }
          : {}),
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        ...(iosApiKey ? { googleMapsApiKey: iosApiKey } : {}),
      },
    },
    extra: {
      ...config.extra,
      maps: {
        provider,
        environment,
        androidConfigured: Boolean(androidApiKey),
        iosConfigured: provider === 'platform' || Boolean(iosApiKey),
        fallbackRegion: {
          latitude: numberFromEnvironment(
            process.env.EXPO_PUBLIC_MAP_DEFAULT_LATITUDE,
            -23.55052,
          ),
          longitude: numberFromEnvironment(
            process.env.EXPO_PUBLIC_MAP_DEFAULT_LONGITUDE,
            -46.633308,
          ),
          latitudeDelta: numberFromEnvironment(
            process.env.EXPO_PUBLIC_MAP_DEFAULT_LATITUDE_DELTA,
            0.08,
          ),
          longitudeDelta: numberFromEnvironment(
            process.env.EXPO_PUBLIC_MAP_DEFAULT_LONGITUDE_DELTA,
            0.08,
          ),
        },
      },
    },
  };
};
