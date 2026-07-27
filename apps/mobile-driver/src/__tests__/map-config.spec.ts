import {
  createMapRuntimeConfig,
  getCurrentMapAvailability,
  getMapAvailability,
  getMapRuntimeConfig,
  parseAppEnvironment,
  parseMapProvider,
} from '@/config/maps';

describe('map configuration', () => {
  it('uses safe defaults without exposing native credentials', () => {
    const config = createMapRuntimeConfig({}, {});
    expect(config).toEqual({
      provider: 'platform',
      environment: 'development',
      androidConfigured: false,
      iosConfigured: false,
      fallbackRegion: {
        latitude: -23.55052,
        longitude: -46.633308,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
    });
    expect(config).not.toHaveProperty('apiKey');
  });

  it('parses explicit and environment-backed values', () => {
    expect(
      createMapRuntimeConfig(
        {
          provider: 'google',
          environment: 'staging',
          androidConfigured: true,
          iosConfigured: true,
          fallbackRegion: {
            latitude: '-22.9',
            longitude: -43.2,
            latitudeDelta: 0.1,
            longitudeDelta: '0.2',
          },
        },
        {},
      ),
    ).toEqual({
      provider: 'google',
      environment: 'staging',
      androidConfigured: true,
      iosConfigured: true,
      fallbackRegion: {
        latitude: -22.9,
        longitude: -43.2,
        latitudeDelta: 0.1,
        longitudeDelta: 0.2,
      },
    });
    expect(
      createMapRuntimeConfig(
        {},
        {
          EXPO_PUBLIC_APP_ENV: 'test',
          EXPO_PUBLIC_MAP_PROVIDER: 'google',
          EXPO_PUBLIC_MAP_DEFAULT_LATITUDE: '-12',
          EXPO_PUBLIC_MAP_DEFAULT_LONGITUDE: '-38',
          EXPO_PUBLIC_MAP_DEFAULT_LATITUDE_DELTA: '0.3',
          EXPO_PUBLIC_MAP_DEFAULT_LONGITUDE_DELTA: '0.4',
        },
      ),
    ).toMatchObject({
      provider: 'google',
      environment: 'test',
      fallbackRegion: {
        latitude: -12,
        longitude: -38,
        latitudeDelta: 0.3,
        longitudeDelta: 0.4,
      },
    });
  });

  it('rejects invalid public values', () => {
    expect(() => parseMapProvider('other')).toThrow(
      'EXPO_PUBLIC_MAP_PROVIDER',
    );
    expect(() => parseAppEnvironment('preview')).toThrow(
      'EXPO_PUBLIC_APP_ENV',
    );
    expect(() =>
      createMapRuntimeConfig(
        { fallbackRegion: { latitude: 'not-a-number' } },
        {},
      ),
    ).toThrow('latitude');
  });

  it('permits missing keys with a warning only outside production', () => {
    const development = createMapRuntimeConfig(
      { environment: 'development' },
      {},
    );
    const production = createMapRuntimeConfig(
      { environment: 'production' },
      {},
    );
    expect(getMapAvailability(development, 'android')).toEqual({
      available: true,
      warning: true,
      reason: 'missing-android-key',
    });
    expect(getMapAvailability(production, 'android')).toEqual({
      available: false,
      warning: false,
      reason: 'missing-android-key',
    });
  });

  it('supports platform maps, configured keys and missing iOS Google keys', () => {
    const platform = createMapRuntimeConfig(
      { provider: 'platform', environment: 'production' },
      {},
    );
    const google = createMapRuntimeConfig(
      {
        provider: 'google',
        environment: 'production',
        androidConfigured: true,
        iosConfigured: true,
      },
      {},
    );
    expect(getMapAvailability(platform, 'ios')).toEqual({
      available: true,
      warning: false,
      reason: 'configured',
    });
    expect(getMapAvailability(google, 'android').available).toBe(true);
    expect(getMapAvailability(google, 'ios').available).toBe(true);
    expect(
      getMapAvailability(
        { ...google, iosConfigured: false },
        'ios',
      ),
    ).toEqual({
      available: false,
      warning: false,
      reason: 'missing-ios-key',
    });
  });

  it('reads Expo runtime data and resolves the current platform', () => {
    expect(getMapRuntimeConfig()).toEqual(
      expect.objectContaining({ fallbackRegion: expect.any(Object) }),
    );
    expect(
      getCurrentMapAvailability(
        createMapRuntimeConfig(
          { androidConfigured: true, iosConfigured: true },
          {},
        ),
      ).available,
    ).toBe(true);
  });
});
