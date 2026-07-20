import {
  getApiMode,
  getDemoCredentials,
  isDevelopmentCatalogEnabled,
} from '@/config/runtime';

describe('runtime configuration', () => {
  it('defaults to mock mode', () => {
    expect(getApiMode({})).toBe('mock');
  });

  it('accepts only explicit supported modes', () => {
    expect(getApiMode({ EXPO_PUBLIC_API_MODE: 'mock' })).toBe('mock');
    expect(getApiMode({ EXPO_PUBLIC_API_MODE: 'api' })).toBe('api');
    expect(() => getApiMode({ EXPO_PUBLIC_API_MODE: 'invalid' })).toThrow(
      'EXPO_PUBLIC_API_MODE inválido',
    );
  });

  it('exposes demo credentials only in mock mode', () => {
    expect(getDemoCredentials('mock')).toEqual({
      email: 'marina.souza@example.com',
      password: 'solis-demo',
    });
    expect(getDemoCredentials('api')).toBeNull();

    const previous = process.env.EXPO_PUBLIC_API_MODE;
    process.env.EXPO_PUBLIC_API_MODE = 'mock';
    expect(getDemoCredentials()).not.toBeNull();
    process.env.EXPO_PUBLIC_API_MODE = previous;
  });

  it('enables the component catalog only for development builds', () => {
    expect(isDevelopmentCatalogEnabled(true)).toBe(true);
    expect(isDevelopmentCatalogEnabled(false)).toBe(false);
    expect(isDevelopmentCatalogEnabled()).toBe(true);
  });
});
