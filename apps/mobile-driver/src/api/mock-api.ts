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
import {
  ids,
  mockHistory,
  mockPaymentMethods,
  mockProfile,
  mockReservations,
  mockStations,
  mockVehicles,
} from '@/mocks/data';
import type {
  AuthSession,
  AuthTokens,
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
import {
  calculatePriceBreakdown,
  estimateAvoidedCo2,
} from '@/utils/charging';
import { normalizeManualConnectorCode } from '@/utils/manual-code';
import type { ChargeQrPayload } from '@/utils/qr-parser';
import { filterStations } from '@/utils/station-filters';

const wait = async (milliseconds = 280): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const demoCredentials = {
  email: 'marina.souza@example.com',
  password: 'solis-demo',
};

let mockIdentity = {
  email: demoCredentials.email,
  password: demoCredentials.password,
  user: mockProfile,
};

function createMockTokens(): AuthTokens {
  return {
    accessToken: `mock-access-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
  };
}

export class MockAuthApi implements AuthApi {
  async register(input: RegisterInput): Promise<AuthSession> {
    await wait();
    const user: UserProfile = {
      ...mockProfile,
      id: `user-${Date.now()}`,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      totalEnergyKwh: 0,
      avoidedCo2Kg: 0,
      chargingSessions: 0,
      estimatedSavings: 0,
    };
    mockIdentity = { email: user.email, password: input.password, user };
    return { user, tokens: createMockTokens() };
  }

  async login(input: LoginInput): Promise<AuthSession> {
    await wait();
    if (
      input.email.trim().toLowerCase() !== mockIdentity.email ||
      input.password !== mockIdentity.password
    ) {
      throw new Error('E-mail ou senha inválidos.');
    }
    return { user: mockIdentity.user, tokens: createMockTokens() };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    await wait();
    if (!refreshToken.startsWith('mock-refresh-')) {
      throw new Error('Sessão expirada.');
    }
    return createMockTokens();
  }
}

export class MockUsersApi implements UsersApi {
  async getMe(): Promise<UserProfile> {
    await wait();
    return mockIdentity.user;
  }
}

let vehicleState = [...mockVehicles];
let paymentState = [...mockPaymentMethods];
let activeSession: ChargingSession | null = null;
const processedStartKeys = new Map<string, ChargingSession>();

function findConnector(
  predicate: (connectorId: string, code: string) => boolean,
): ValidatedConnector {
  for (const station of mockStations) {
    const connector = station.connectors.find((candidate) =>
      predicate(candidate.id, candidate.code),
    );

    if (connector) {
      if (station.status === 'OFFLINE' || connector.status === 'OFFLINE') {
        throw new Error('O carregador está offline no momento.');
      }
      if (connector.status !== 'AVAILABLE') {
        throw new Error('Este conector não está disponível.');
      }

      return {
        station,
        connector,
        estimatedPreauthorization: 80,
      };
    }
  }

  throw new Error('Conector não encontrado.');
}

export class MockStationsApi implements StationsApi {
  async getNearby(filters: StationFilters): Promise<Station[]> {
    await wait();
    return filterStations(mockStations, filters);
  }

  async getById(stationId: string): Promise<Station> {
    await wait();
    const station = mockStations.find((candidate) => candidate.id === stationId);
    if (!station) throw new Error('Estação não encontrada.');
    return station;
  }

  async createReservation(
    stationId: string,
    connectorId: string,
  ): Promise<Reservation> {
    await wait();
    const station = await this.getById(stationId);
    const connector = station.connectors.find((item) => item.id === connectorId);
    if (!connector || connector.status !== 'AVAILABLE') {
      throw new Error('Não foi possível reservar este conector.');
    }

    return {
      id: `reservation-${Date.now()}`,
      stationName: station.name,
      connectorLabel: `${connector.plugType} · ${connector.maximumPowerKw} kW`,
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      status: 'CONFIRMED',
    };
  }

  async listReservations(): Promise<Reservation[]> {
    await wait();
    return [...mockReservations];
  }
}

export class MockChargingApi implements ChargingApi {
  async validateQr(payload: ChargeQrPayload): Promise<ValidatedConnector> {
    await wait();
    return findConnector((connectorId) => connectorId === payload.connectorId);
  }

  async validateManualCode(code: string): Promise<ValidatedConnector> {
    await wait();
    const normalizedCode = normalizeManualConnectorCode(code);
    return findConnector((_, connectorCode) => connectorCode === normalizedCode);
  }

  async start(input: StartChargingInput): Promise<ChargingSession> {
    await wait(600);

    const previous = processedStartKeys.get(input.idempotencyKey);
    if (previous) return previous;
    if (activeSession?.status === 'charging') {
      throw new Error('Já existe uma sessão ativa para este usuário.');
    }
    if (!paymentState.some((payment) => payment.id === input.paymentMethodId)) {
      throw new Error('Selecione uma forma de pagamento válida.');
    }

    const session: ChargingSession = {
      id: `session-${Date.now()}`,
      stationId: input.validatedConnector.station.id,
      stationName: input.validatedConnector.station.name,
      connectorId: input.validatedConnector.connector.id,
      connectorLabel: `${input.validatedConnector.connector.plugType} · ${input.validatedConnector.connector.maximumPowerKw} kW`,
      vehicleId: input.vehicleId,
      paymentMethodId: input.paymentMethodId,
      status: 'charging',
      startedAt: new Date().toISOString(),
      elapsedSeconds: 0,
      energyKwh: 0,
      currentPowerKw: Math.min(input.validatedConnector.connector.maximumPowerKw, 74),
      estimatedCost: 0,
      estimatedBatteryPercent: 42,
      tariffPerKwh: input.validatedConnector.station.pricePerKwh,
      estimatedEndAt: new Date(Date.now() + 42 * 60_000).toISOString(),
    };

    activeSession = session;
    processedStartKeys.set(input.idempotencyKey, session);
    return session;
  }

  async getActive(): Promise<ChargingSession | null> {
    await wait();
    return activeSession;
  }

  async getById(sessionId: string): Promise<ChargingSession> {
    await wait();
    if (!activeSession || activeSession.id !== sessionId) {
      throw new Error('Sessão não encontrada.');
    }
    return activeSession;
  }

  async stop(sessionId: string): Promise<ChargingSummary> {
    await wait(500);
    if (!activeSession || activeSession.id !== sessionId) {
      throw new Error('Sessão ativa não encontrada.');
    }

    const completedSession: ChargingSession = {
      ...activeSession,
      status: 'completed',
    };
    const price = calculatePriceBreakdown(
      completedSession.energyKwh,
      completedSession.tariffPerKwh,
    );
    const summary: ChargingSummary = {
      session: completedSession,
      stoppedAt: new Date().toISOString(),
      durationSeconds: completedSession.elapsedSeconds,
      energyKwh: completedSession.energyKwh,
      paymentMethodId: completedSession.paymentMethodId,
      price,
      avoidedCo2Kg: estimateAvoidedCo2(completedSession.energyKwh),
    };

    activeSession = null;
    return summary;
  }

  async getHistory() {
    await wait();
    return [...mockHistory];
  }
}

export class MockVehiclesApi implements VehiclesApi {
  async list(): Promise<Vehicle[]> {
    await wait();
    return [...vehicleState];
  }

  async create(
    input: Omit<Vehicle, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Vehicle> {
    await wait();
    const now = new Date().toISOString();
    const vehicle: Vehicle = {
      ...input,
      id: `vehicle-${Date.now()}`,
      userId: ids.user,
      createdAt: now,
      updatedAt: now,
    };
    vehicleState = input.isDefault
      ? [...vehicleState.map((item) => ({ ...item, isDefault: false })), vehicle]
      : [...vehicleState, vehicle];
    return vehicle;
  }

  async update(vehicleId: string, input: Partial<Vehicle>): Promise<Vehicle> {
    await wait();
    const current = vehicleState.find((item) => item.id === vehicleId);
    if (!current) throw new Error('Veículo não encontrado.');

    const updated: Vehicle = {
      ...current,
      ...input,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    vehicleState = vehicleState.map((item) => {
      if (input.isDefault && item.id !== vehicleId) {
        return { ...item, isDefault: false };
      }
      return item.id === vehicleId ? updated : item;
    });
    return updated;
  }
}

export class MockPaymentsApi implements PaymentsApi {
  async list(): Promise<PaymentMethod[]> {
    await wait();
    return [...paymentState];
  }

  async setDefault(paymentMethodId: string): Promise<PaymentMethod[]> {
    await wait();
    paymentState = paymentState.map((method) => ({
      ...method,
      isDefault: method.id === paymentMethodId,
    }));
    return [...paymentState];
  }

  async remove(paymentMethodId: string): Promise<void> {
    await wait();
    paymentState = paymentState.filter((method) => method.id !== paymentMethodId);
  }

  async createMockPix(amount: number): Promise<{ code: string; expiresAt: string }> {
    await wait();
    if (amount <= 0) throw new Error('Informe um valor maior que zero.');
    return {
      code: `SOLIS-PIX-MOCK-${amount.toFixed(2)}-${Date.now()}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }
}

export class MockRoutePlannerProvider implements RoutePlannerProvider {
  async calculateRoute(input: RoutePlannerInput): Promise<RoutePlannerResult> {
    await wait(450);
    const vehicle = vehicleState.find((item) => item.id === input.vehicleId);
    if (!vehicle) throw new Error('Selecione um veículo válido.');

    const distanceKm = input.priority === 'SHORTEST_TIME' ? 326 : 311;
    const consumptionPerKm =
      (vehicle.averageConsumptionKwhPer100Km ?? 17) / 100;
    const estimatedConsumptionKwh = Number(
      (distanceKm * consumptionPerKm).toFixed(1),
    );

    return {
      distanceKm,
      durationMinutes: input.avoidTolls ? 292 : 264,
      estimatedConsumptionKwh,
      arrivalBatteryPercent: input.minimumArrivalBatteryPercent + 2,
      stops: [
        {
          station: mockStations[0]!,
          arrivalBatteryPercent: 18,
          chargeDurationMinutes: input.preferFastChargers ? 24 : 36,
          departureBatteryPercent: 72,
        },
      ],
      estimatedChargingCost: Number(
        (estimatedConsumptionKwh * mockStations[0]!.pricePerKwh).toFixed(2),
      ),
    };
  }
}

export function createMockApiClients(): ApiClients {
  return {
    auth: new MockAuthApi(),
    users: new MockUsersApi(),
    stations: new MockStationsApi(),
    charging: new MockChargingApi(),
    vehicles: new MockVehiclesApi(),
    payments: new MockPaymentsApi(),
    routePlanner: new MockRoutePlannerProvider(),
  };
}
