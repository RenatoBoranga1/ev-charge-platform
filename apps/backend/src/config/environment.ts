interface Environment {
  corsOrigin: string;
  defaultTenantSlug: string;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  nodeEnv: string;
  port: number;
  redisUrl: string;
  refreshTokenTtlDays: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Valor inteiro positivo inválido: ${value}`);
  }
  return parsed;
}

function requiredSecret(value: string | undefined): string {
  const secret = value ?? 'development-only-secret-change-me';
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres.');
  }
  return secret;
}

export const environment: Environment = {
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
};
