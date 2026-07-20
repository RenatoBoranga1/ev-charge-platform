import type {
  ApiClients,
  AuthApi,
  ChargingApi,
  PaymentsApi,
  RoutePlannerProvider,
  StartChargingInput,
  StationsApi,
  UsersApi,
  VehiclesApi,
} from './contracts';
import { tokenStorage } from '@/auth/token-storage';
import { AppLogger } from '@/logging/AppLogger';
import type {
  AuthSession,
  AuthTokens,
  ChargingHistoryItem,
  ChargingSession,
  ChargingSummary,
  LoginInput,
  PaymentMethod,
  RegisterInput,
  Reservation,
  RoutePlannerInput,
  RoutePlannerResult,
  Station,
  StationFilters,
  UserProfile,
  ValidatedConnector,
  Vehicle,
} from '@/types/domain';
import type { ChargeQrPayload } from '@/utils/qr-parser';

interface RestRequestInit extends RequestInit {
  retryOnUnauthorized?: boolean;
  skipAuth?: boolean;
}

interface ApiErrorBody {
  message?: string | string[];
}

export class RestClient {
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, init: RestRequestInit = {}): Promise<T> {
    const {
      retryOnUnauthorized = true,
      skipAuth = false,
      ...requestInit
    } = init;
    const headers = new Headers(requestInit.headers);
    headers.set('Content-Type', 'application/json');

    if (!skipAuth) {
      const accessToken = await tokenStorage.getAccessToken();
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...requestInit,
      headers,
    });

    if (response.status === 401 && !skipAuth && retryOnUnauthorized) {
      await this.refreshTokens();
      return this.request<T>(path, { ...init, retryOnUnauthorized: false });
    }

    if (!response.ok) {
      const body = await this.parseBody<ApiErrorBody>(response);
      const details = Array.isArray(body?.message)
        ? body.message.join(' ')
        : body?.message;
      AppLogger.error('API request failed', {
        path,
        status: response.status,
      });
      throw new Error(details || `A API respondeu com status ${response.status}.`);
    }

    if (response.status === 204) return undefined as T;
    return (await this.parseBody<T>(response)) as T;
  }

  private async parseBody<T>(response: Response): Promise<T | null> {
    const rawBody = await response.text();
    if (!rawBody) return null;
    try {
      return JSON.parse(rawBody) as T;
    } catch {
      return { message: rawBody } as T;
    }
  }

  private async refreshTokens(): Promise<AuthTokens> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('Sessão expirada.');

        try {
          const tokens = await this.request<AuthTokens>('/v1/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
            retryOnUnauthorized: false,
            skipAuth: true,
          });
          await tokenStorage.setTokens(tokens);
          return tokens;
        } catch (error) {
          await tokenStorage.clearTokens();
          AppLogger.warn('Session refresh failed');
          throw error;
        }
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }
}

class RestAuthApi implements AuthApi {
  constructor(private readonly client: RestClient) {}

  register(input: RegisterInput): Promise<AuthSession> {
    return this.client.request<AuthSession>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
      skipAuth: true,
    });
  }

  login(input: LoginInput): Promise<AuthSession> {
    return this.client.request<AuthSession>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
      skipAuth: true,
    });
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.client.request<AuthTokens>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      retryOnUnauthorized: false,
      skipAuth: true,
    });
  }
}

class RestUsersApi implements UsersApi {
  constructor(private readonly client: RestClient) {}

  getMe(): Promise<UserProfile> {
    return this.client.request<UserProfile>('/v1/users/me');
  }
}

class RestStationsApi implements StationsApi {
  constructor(private readonly client: RestClient) {}

  getNearby(filters: StationFilters): Promise<Station[]> {
    const query = new URLSearchParams({
      distanceKm: String(filters.maximumDistanceKm),
      minimumPowerKw: String(filters.minimumPowerKw),
      maximumPricePerKwh: String(filters.maximumPricePerKwh),
    });
    return this.client.request<Station[]>(`/v1/stations/nearby?${query}`);
  }

  getById(stationId: string): Promise<Station> {
    return this.client.request<Station>(`/v1/stations/${stationId}`);
  }

  createReservation(stationId: string, connectorId: string): Promise<Reservation> {
    return this.client.request<Reservation>('/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({ stationId, connectorId }),
    });
  }

  listReservations(): Promise<Reservation[]> {
    return this.client.request<Reservation[]>('/v1/reservations');
  }
}

class RestChargingApi implements ChargingApi {
  constructor(private readonly client: RestClient) {}

  validateQr(payload: ChargeQrPayload): Promise<ValidatedConnector> {
    return this.client.request<ValidatedConnector>(
      '/v1/charging-sessions/validate-qr',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  validateManualCode(code: string): Promise<ValidatedConnector> {
    return this.client.request<ValidatedConnector>(
      '/v1/charging-sessions/validate-qr',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
    );
  }

  start(input: StartChargingInput): Promise<ChargingSession> {
    return this.client.request<ChargingSession>('/v1/charging-sessions/start', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  getActive(): Promise<ChargingSession | null> {
    return this.client.request<ChargingSession | null>(
      '/v1/charging-sessions/active',
    );
  }

  getById(sessionId: string): Promise<ChargingSession> {
    return this.client.request<ChargingSession>(
      `/v1/charging-sessions/${sessionId}`,
    );
  }

  stop(sessionId: string): Promise<ChargingSummary> {
    return this.client.request<ChargingSummary>(
      `/v1/charging-sessions/${sessionId}/stop`,
      { method: 'POST' },
    );
  }

  getHistory(): Promise<ChargingHistoryItem[]> {
    return this.client.request<ChargingHistoryItem[]>(
      '/v1/charging-sessions/history',
    );
  }
}

class RestVehiclesApi implements VehiclesApi {
  constructor(private readonly client: RestClient) {}

  list(): Promise<Vehicle[]> {
    return this.client.request<Vehicle[]>('/v1/users/me/vehicles');
  }

  create(
    input: Omit<Vehicle, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Vehicle> {
    return this.client.request<Vehicle>('/v1/users/me/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  update(vehicleId: string, input: Partial<Vehicle>): Promise<Vehicle> {
    return this.client.request<Vehicle>(
      `/v1/users/me/vehicles/${vehicleId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
  }
}

class RestPaymentsApi implements PaymentsApi {
  constructor(private readonly client: RestClient) {}

  list(): Promise<PaymentMethod[]> {
    return this.client.request<PaymentMethod[]>('/v1/payment-methods');
  }

  setDefault(paymentMethodId: string): Promise<PaymentMethod[]> {
    return this.client.request<PaymentMethod[]>(
      `/v1/payment-methods/${paymentMethodId}/default`,
      { method: 'POST' },
    );
  }

  async remove(paymentMethodId: string): Promise<void> {
    await this.client.request<void>(`/v1/payment-methods/${paymentMethodId}`, {
      method: 'DELETE',
    });
  }

  createMockPix(amount: number): Promise<{ code: string; expiresAt: string }> {
    return this.client.request('/v1/payments/pix', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }
}

class RestRoutePlannerProvider implements RoutePlannerProvider {
  constructor(private readonly client: RestClient) {}

  calculateRoute(input: RoutePlannerInput): Promise<RoutePlannerResult> {
    return this.client.request<RoutePlannerResult>('/v1/routes/plan', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}

export function createRestApiClients(baseUrl: string): ApiClients {
  const client = new RestClient(baseUrl.replace(/\/$/, ''));
  return {
    auth: new RestAuthApi(client),
    users: new RestUsersApi(client),
    stations: new RestStationsApi(client),
    charging: new RestChargingApi(client),
    vehicles: new RestVehiclesApi(client),
    payments: new RestPaymentsApi(client),
    routePlanner: new RestRoutePlannerProvider(client),
  };
}
