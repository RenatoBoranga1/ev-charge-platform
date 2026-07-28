type OcppAuthMode = 'basic' | 'none';
type DuplicateConnectionPolicy = 'replace' | 'reject';

interface Environment {
  backendInternalUrl: string;
  chargerSimulatorUrl: string;
  corsOrigins: string[];
  defaultTenantSlug: string;
  httpPayloadLimit: string;
  historyCursorSecret: string;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  nodeEnv: string;
  ocppAuthMode: OcppAuthMode;
  ocppCommandTimeoutMs: number;
  ocppDuplicateConnectionPolicy: DuplicateConnectionPolicy;
  ocppEnabled: boolean;
  ocppHeartbeatIntervalSeconds: number;
  ocppIdleTimeoutMs: number;
  ocppMaxPayloadBytes: number;
  ocppMessageRateLimit: number;
  ocppPort: number;
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

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Invalid boolean value: ' + value);
}

function oneOf<T extends string>(
  value: string | undefined,
  fallback: T,
  supported: readonly T[],
): T {
  const selected = (value ?? fallback) as T;
  if (!supported.includes(selected)) {
    throw new Error('Unsupported configuration value: ' + selected);
  }
  return selected;
}

function configuredCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) {
    throw new Error('CORS_ORIGINS must contain explicit origins; wildcard is forbidden.');
  }
  return origins;
}

function requiredSecret(
  value: string | undefined,
  name: string,
  fallback: string,
): string {
  const secret = value ?? fallback;
  if ((process.env.NODE_ENV ?? 'development') === 'production' && secret.length < 32) {
    throw new Error(`${name} must have at least 32 characters.`);
  }
  return secret;
}

const jwtAccessSecret = requiredSecret(
  process.env.JWT_ACCESS_SECRET,
  'JWT_ACCESS_SECRET',
  'development-jwt-secret-change-me',
);
const historyCursorSecret = requiredSecret(
  process.env.HISTORY_CURSOR_SECRET,
  'HISTORY_CURSOR_SECRET',
  'development-history-cursor-secret-change-me',
);
if (historyCursorSecret === jwtAccessSecret) {
  throw new Error('HISTORY_CURSOR_SECRET must differ from JWT_ACCESS_SECRET.');
}

export const environment: Environment = {
  backendInternalUrl:
    process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8000',
  chargerSimulatorUrl:
    process.env.CHARGER_SIMULATOR_URL ?? 'http://localhost:8100',
  corsOrigins: configuredCorsOrigins(process.env.CORS_ORIGINS),
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG ?? 'solis',
  httpPayloadLimit: process.env.HTTP_PAYLOAD_LIMIT ?? '100kb',
  historyCursorSecret,
  jwtAccessSecret,
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  ocppAuthMode: oneOf(process.env.OCPP_AUTH_MODE, 'basic', ['basic', 'none']),
  ocppCommandTimeoutMs: positiveInteger(process.env.OCPP_COMMAND_TIMEOUT_MS, 15_000),
  ocppDuplicateConnectionPolicy: oneOf(
    process.env.OCPP_DUPLICATE_CONNECTION_POLICY,
    'replace',
    ['replace', 'reject'],
  ),
  ocppEnabled: booleanValue(process.env.OCPP_ENABLED, true),
  ocppHeartbeatIntervalSeconds: positiveInteger(
    process.env.OCPP_HEARTBEAT_INTERVAL_SECONDS,
    60,
  ),
  ocppIdleTimeoutMs: positiveInteger(process.env.OCPP_IDLE_TIMEOUT_MS, 120_000),
  ocppMaxPayloadBytes: positiveInteger(process.env.OCPP_MAX_PAYLOAD_BYTES, 64 * 1024),
  ocppMessageRateLimit: positiveInteger(process.env.OCPP_MESSAGE_RATE_LIMIT, 120),
  ocppPort: positiveInteger(process.env.OCPP_PORT, 9000),
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
