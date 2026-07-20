import type {
  ApiClients,
  ChargingApi,
  PaymentsApi,
  RoutePlannerProvider,
  StartChargingInput,
  StationsApi,
  VehiclesApi,
} from './contracts';
import type {
  ChargingHistoryItem,
  ChargingSession,
  ChargingSummary,
  PaymentMethod,
  Reservation,
  RoutePlannerInput,
  RoutePlannerResult,
  Station,
  StationFilters,
  ValidatedConnector,
  Vehicle,
} from '@/types/domain';

class RestClient {
  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `A API respondeu com status ${response.status}.`);
    }

    return (await response.json()) as T;
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

  validateQr(rawValue: string): Promise<ValidatedConnector> {
    return this.client.request<ValidatedConnector>('/v1/charging-sessions/validate-qr', {
      method: 'POST',
      body: JSON.stringify({ rawValue }),
    });
  }

  validateManualCode(code: string): Promise<ValidatedConnector> {
    return this.client.request<ValidatedConnector>('/v1/charging-sessions/validate-qr', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  start(input: StartChargingInput): Promise<ChargingSession> {
    return this.client.request<ChargingSession>('/v1/charging-sessions/start', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  getActive(): Promise<ChargingSession | null> {
    return this.client.request<ChargingSession | null>('/v1/charging-sessions/active');
  }

  getById(sessionId: string): Promise<ChargingSession> {
    return this.client.request<ChargingSession>(`/v1/charging-sessions/${sessionId}`);
  }

  stop(sessionId: string): Promise<ChargingSummary> {
    return this.client.request<ChargingSummary>(
      `/v1/charging-sessions/${sessionId}/stop`,
      { method: 'POST' },
    );
  }

  getHistory(): Promise<ChargingHistoryItem[]> {
    return this.client.request<ChargingHistoryItem[]>('/v1/charging-sessions/history');
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
    return this.client.request<Vehicle>(`/v1/users/me/vehicles/${vehicleId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
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
    await this.client.request<unknown>(`/v1/payment-methods/${paymentMethodId}`, {
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
    stations: new RestStationsApi(client),
    charging: new RestChargingApi(client),
    vehicles: new RestVehiclesApi(client),
    payments: new RestPaymentsApi(client),
    routePlanner: new RestRoutePlannerProvider(client),
  };
}
