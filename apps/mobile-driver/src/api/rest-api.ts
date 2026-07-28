import type {
  ApiClients,
  AuthApi,
  ChargingApi,
  ChargingHistoryApi,
  DashboardApi,
  NearbyStationsOptions,
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
  ChargingHistoryFilters,
  ChargingHistoryPage,
  ChargingSessionDetails,
  ChargingSessionMetricsData,
  ChargingSessionTimelineData,
  DashboardData,
  DashboardQuery,
  ChargingSession,
  ChargingSessionRealtimeEvent,
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
  UpdateProfileInput,
  VehicleCreateInput,
  VehicleListFilters,
  VehicleUpdateInput,
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
    const { retryOnUnauthorized = true, skipAuth = false, ...requestInit } = init;
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
      const details = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
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

  update(input: UpdateProfileInput): Promise<UserProfile> {
    return this.client.request<UserProfile>('/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  requestDeletion(recordVersion: number): Promise<UserProfile> {
    return this.client.request<UserProfile>('/v1/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ recordVersion }),
    });
  }
}

class RestStationsApi implements StationsApi {
  constructor(private readonly client: RestClient) {}

  getNearby(filters: StationFilters, options?: NearbyStationsOptions): Promise<Station[]> {
    const query = new URLSearchParams({
      distanceKm: String(filters.maximumDistanceKm),
      minimumPowerKw: String(filters.minimumPowerKw),
      maximumPricePerKwh: String(filters.maximumPricePerKwh),
      ...(options
        ? {
            latitude: String(options.latitude),
            longitude: String(options.longitude),
          }
        : {}),
    });
    return this.client.request<Station[]>(`/v1/stations/nearby?${query}`, {
      ...(options?.signal ? { signal: options.signal } : {}),
    });
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
    return this.client.request<ValidatedConnector>('/v1/charging-sessions/validate-qr', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  validateManualCode(code: string): Promise<ValidatedConnector> {
    return this.client.request<ValidatedConnector>('/v1/charging-sessions/validate-qr', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async start(input: StartChargingInput): Promise<ChargingSession> {
    const created = await this.client.request<ChargingSession>('/v1/charging-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        connectorId: input.validatedConnector.connector.id,
        paymentMethodId: input.paymentMethodId,
        vehicleId: input.vehicleId,
      }),
    });
    return this.client.request<ChargingSession>('/v1/charging-sessions/' + created.id + '/start', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey + ':start' },
    });
  }

  getActive(): Promise<ChargingSession | null> {
    return this.client.request<ChargingSession | null>('/v1/charging-sessions/active');
  }

  getById(sessionId: string): Promise<ChargingSession> {
    return this.client.request<ChargingSession>(`/v1/charging-sessions/${sessionId}`);
  }

  getMetrics(sessionId: string): Promise<ChargingSessionRealtimeEvent> {
    return this.client.request<ChargingSessionRealtimeEvent>(
      `/v1/charging-sessions/${sessionId}/metrics`,
    );
  }

  stop(sessionId: string, idempotencyKey: string): Promise<ChargingSummary> {
    return this.client.request<ChargingSummary>(`/v1/charging-sessions/${sessionId}/stop`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
}

function appendDashboardQuery(query: URLSearchParams, input: DashboardQuery): void {
  if (input.from) query.set('from', input.from);
  if (input.to) query.set('to', input.to);
  if (input.timezone) query.set('timezone', input.timezone);
  if (input.vehicleId) query.set('vehicleId', input.vehicleId);
}

class RestDashboardApi implements DashboardApi {
  constructor(private readonly client: RestClient) {}

  get(input: DashboardQuery = {}, signal?: AbortSignal): Promise<DashboardData> {
    const query = new URLSearchParams();
    appendDashboardQuery(query, input);
    const suffix = query.size > 0 ? `?${query}` : '';
    return this.client.request<DashboardData>(
      `/v1/users/me/dashboard${suffix}`,
      signal ? { signal } : {},
    );
  }
}

class RestChargingHistoryApi implements ChargingHistoryApi {
  constructor(private readonly client: RestClient) {}

  list(
    filters: ChargingHistoryFilters,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<ChargingHistoryPage> {
    const query = new URLSearchParams();
    appendDashboardQuery(query, filters);
    query.set('sort', filters.sort);
    if (filters.limit) query.set('limit', String(filters.limit));
    if (cursor) query.set('cursor', cursor);
    if (filters.stationId) query.set('stationId', filters.stationId);
    if (filters.status) query.set('status', filters.status.toUpperCase());
    if (filters.connectorType) {
      query.set('connectorType', filters.connectorType);
    }
    if (filters.search) query.set('search', filters.search);
    if (filters.withCost !== undefined) {
      query.set('withCost', String(filters.withCost));
    }
    if (filters.failuresOnly !== undefined) {
      query.set('failuresOnly', String(filters.failuresOnly));
    }
    if (filters.completedOnly !== undefined) {
      query.set('completedOnly', String(filters.completedOnly));
    }
    return this.client.request<ChargingHistoryPage>(
      `/v1/users/me/charging-sessions?${query}`,
      signal ? { signal } : {},
    );
  }

  getDetails(sessionId: string, signal?: AbortSignal): Promise<ChargingSessionDetails> {
    return this.client.request<ChargingSessionDetails>(
      `/v1/users/me/charging-sessions/${sessionId}`,
      signal ? { signal } : {},
    );
  }

  getTimeline(sessionId: string, signal?: AbortSignal): Promise<ChargingSessionTimelineData> {
    return this.client.request<ChargingSessionTimelineData>(
      `/v1/users/me/charging-sessions/${sessionId}/timeline`,
      signal ? { signal } : {},
    );
  }

  getMetrics(
    sessionId: string,
    maxPoints = 60,
    signal?: AbortSignal,
  ): Promise<ChargingSessionMetricsData> {
    return this.client.request<ChargingSessionMetricsData>(
      `/v1/users/me/charging-sessions/${sessionId}/metrics?maxPoints=${maxPoints}`,
      signal ? { signal } : {},
    );
  }
}

class RestVehiclesApi implements VehiclesApi {
  constructor(private readonly client: RestClient) {}

  list(filters: VehicleListFilters = {}): Promise<Vehicle[]> {
    const query = new URLSearchParams();
    if (filters.search) query.set('search', filters.search);
    if (filters.type) query.set('type', filters.type);
    if (filters.status) query.set('status', filters.status);
    if (filters.sortBy) query.set('sortBy', filters.sortBy);
    if (filters.sortOrder) query.set('sortOrder', filters.sortOrder);
    const suffix = query.size > 0 ? `?${query}` : '';
    return this.client.request<Vehicle[]>(`/v1/users/me/vehicles${suffix}`);
  }

  getById(vehicleId: string): Promise<Vehicle> {
    return this.client.request<Vehicle>(`/v1/users/me/vehicles/${vehicleId}`);
  }

  create(input: VehicleCreateInput): Promise<Vehicle> {
    return this.client.request<Vehicle>('/v1/users/me/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  update(vehicleId: string, input: VehicleUpdateInput): Promise<Vehicle> {
    return this.client.request<Vehicle>(`/v1/users/me/vehicles/${vehicleId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }
  setDefault(vehicleId: string, recordVersion: number): Promise<Vehicle> {
    return this.client.request<Vehicle>(`/v1/users/me/vehicles/${vehicleId}/default`, {
      method: 'POST',
      body: JSON.stringify({ recordVersion }),
    });
  }

  duplicate(vehicleId: string, recordVersion: number): Promise<Vehicle> {
    return this.client.request<Vehicle>(`/v1/users/me/vehicles/${vehicleId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ recordVersion }),
    });
  }

  async remove(vehicleId: string, recordVersion: number): Promise<void> {
    await this.client.request<void>(`/v1/users/me/vehicles/${vehicleId}`, {
      method: 'DELETE',
      body: JSON.stringify({ recordVersion }),
    });
  }
}

class RestPaymentsApi implements PaymentsApi {
  constructor(private readonly client: RestClient) {}

  list(): Promise<PaymentMethod[]> {
    return this.client.request<PaymentMethod[]>('/v1/payment-methods');
  }

  setDefault(paymentMethodId: string): Promise<PaymentMethod[]> {
    return this.client.request<PaymentMethod[]>(`/v1/payment-methods/${paymentMethodId}/default`, {
      method: 'POST',
    });
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
    dashboard: new RestDashboardApi(client),
    history: new RestChargingHistoryApi(client),
    stations: new RestStationsApi(client),
    charging: new RestChargingApi(client),
    vehicles: new RestVehiclesApi(client),
    payments: new RestPaymentsApi(client),
    routePlanner: new RestRoutePlannerProvider(client),
  };
}
