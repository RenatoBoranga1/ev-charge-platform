interface Environment {
  backendInternalUrl: string;
  chargerSimulatorUrl: string;
  corsOrigin: string;
  defaultTenantSlug: string;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  nodeEnv: string;
  port: number;
  redisUrl: string;
  refreshTokenTtlDays: number;
  simulatorScenario: string;
  simulatorSecret: string;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Invalid positive integer value: ' + value);
  }
  return parsed;
}

function requiredSecret(value: string | undefined): string {
  const secret = value ?? 'development-only-secret-change-me';
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must have at least 32 characters.');
  }
  return secret;
}

export const environment: Environment = {
  backendInternalUrl:
    process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8000',
  chargerSimulatorUrl:
    process.env.CHARGER_SIMULATOR_URL ?? 'http://localhost:8100',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG ?? 'solis',
  jwtAccessSecret: requiredSecret(process.env.JWT_ACCESS_SECRET),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: positiveInteger(process.env.PORT, 8000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  refreshTokenTtlDays: positiveInteger(
    process.env.REFRESH_TOKEN_TTL_DAYS,
    30,
  ),
  simulatorScenario: process.env.SIMULATOR_SCENARIO ?? 'normal',
  simulatorSecret:
    process.env.SIMULATOR_SECRET ?? 'local-simulator-secret-change-me',
};
