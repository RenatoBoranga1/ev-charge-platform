export type ApiMode = 'mock' | 'api';

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

export function getApiMode(
  environment: PublicEnvironment = process.env,
): ApiMode {
  const mode = environment.EXPO_PUBLIC_API_MODE ?? 'mock';
  if (mode === 'mock' || mode === 'api') return mode;
  throw new Error(`EXPO_PUBLIC_API_MODE inválido: ${mode}`);
}

export function isDevelopmentCatalogEnabled(
  developmentFlag = typeof __DEV__ !== 'undefined' && __DEV__,
): boolean {
  return developmentFlag;
}

export function getDemoCredentials(
  mode: ApiMode = getApiMode(),
): { email: string; password: string } | null {
  if (mode !== 'mock') return null;
  return {
    email: 'marina.souza@example.com',
    password: 'solis-demo',
  };
}
