import type {
  ApiClients,
  AuthApi,
  ChargingApi,
  ChargingHistoryApi,
  DashboardApi,
  NearbyStationsOptions,
  PaymentsApi,
  CreatePaymentMethodInput,
  CreateTopUpInput,
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
  ChargingHistoryFilters,
  ChargingHistoryItem,
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
  AutoRechargeRule,
  ChargingReceipt,
  PaymentMethod,
  PaymentIntent,
  RegisterInput,
  Reservation,
  Wallet,
  WalletTransaction,
  WalletTransactionPage,
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
import { calculatePriceBreakdown, estimateAvoidedCo2 } from '@/utils/charging';
import { normalizeManualConnectorCode } from '@/utils/manual-code';
import type { ChargeQrPayload } from '@/utils/qr-parser';
import { filterStations } from '@/utils/station-filters';
import { filterAndSortVehicles } from '@/garage/vehicle-catalog';

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

  async update(input: UpdateProfileInput): Promise<UserProfile> {
    await wait();
    const current = mockIdentity.user;
    if (current.recordVersion !== input.recordVersion) {
      throw new Error('O perfil foi alterado. Atualize e tente novamente.');
    }
    const firstName = input.firstName?.trim() ?? current.firstName;
    const lastName = input.lastName?.trim() ?? current.lastName;
    const user: UserProfile = {
      ...current,
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      firstName,
      ...(input.language !== undefined ? { language: input.language } : {}),
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      notifications: {
        ...current.notifications,
        ...input.notifications,
      },
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      preferences: {
        ...current.preferences,
        ...input.preferences,
      },
      privacy: {
        ...current.privacy,
        ...input.privacy,
      },
      recordVersion: current.recordVersion + 1,
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
    };
    mockIdentity = {
      ...mockIdentity,
      email: user.email,
      user,
    };
    return user;
  }

  async requestDeletion(recordVersion: number): Promise<UserProfile> {
    await wait();
    if (mockIdentity.user.recordVersion !== recordVersion) {
      throw new Error('O perfil foi alterado. Atualize e tente novamente.');
    }
    const user: UserProfile = {
      ...mockIdentity.user,
      accountDeletionRequestedAt: new Date().toISOString(),
      recordVersion: recordVersion + 1,
    };
    mockIdentity = { ...mockIdentity, user };
    return user;
  }
}

let vehicleState = [...mockVehicles];
let paymentState = [...mockPaymentMethods];
let walletState: Wallet = {
  availableBalanceMinor: '29266',
  currency: 'BRL',
  id: 'mock-wallet',
  reservedBalanceMinor: '0',
  status: 'ACTIVE',
  updatedAt: new Date().toISOString(),
  version: 1,
};
let walletTransactions: WalletTransaction[] = [];
let autoRechargeState: AutoRechargeRule = {
  cooldownUntil: null,
  currency: 'BRL',
  enabled: false,
  failureCount: 0,
  id: null,
  minimumBalanceMinor: '5000',
  paymentMethodId: null,
  rechargeAmountMinor: '10000',
};
const mockPaymentIntents = new Map<string, PaymentIntent & { polls?: number; credited?: boolean }>();
let activeSession: ChargingSession | null = null;
const processedStartKeys = new Map<string, ChargingSession>();
const processedStopKeys = new Map<string, ChargingSummary>();

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
  async getNearby(filters: StationFilters, options?: NearbyStationsOptions): Promise<Station[]> {
    if (options?.signal?.aborted) {
      throw new Error('A busca de estações foi cancelada.');
    }
    await wait();
    if (options?.signal?.aborted) throw new Error('A busca foi cancelada.');
    return filterStations(mockStations, filters);
  }

  async getById(stationId: string): Promise<Station> {
    await wait();
    const station = mockStations.find((candidate) => candidate.id === stationId);
    if (!station) throw new Error('Estação não encontrada.');
    return station;
  }

  async createReservation(stationId: string, connectorId: string): Promise<Reservation> {
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

  async getMetrics(sessionId: string): Promise<ChargingSessionRealtimeEvent> {
    const session = await this.getById(sessionId);
    return {
      currentPowerKw: session.currentPowerKw,
      elapsedSeconds: session.elapsedSeconds,
      energyKwh: session.energyKwh,
      ...(session.estimatedBatteryPercent !== undefined
        ? { estimatedBatteryPercent: session.estimatedBatteryPercent }
        : {}),
      estimatedCost: session.estimatedCost,
      occurredAt: new Date().toISOString(),
      sessionId: session.id,
      status: session.status,
    };
  }

  async stop(sessionId: string, idempotencyKey: string): Promise<ChargingSummary> {
    await wait(500);
    const previous = processedStopKeys.get(idempotencyKey);
    if (previous) return previous;
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
    processedStopKeys.set(idempotencyKey, summary);
    return summary;
  }

  async getHistory() {
    await wait();
    return [...mockHistory];
  }
}

function toMockHistoryItem(item: (typeof mockHistory)[number]): ChargingHistoryItem {
  const station =
    mockStations.find((candidate) => candidate.name === item.stationName) ?? mockStations[0]!;
  const vehicle = mockVehicles[0]!;
  const connector = station.connectors[0] ?? mockStations[0]!.connectors[0]!;
  return {
    connector: {
      id: connector.id,
      label: `${connector.plugType} · ${connector.maximumPowerKw} kW`,
      type: connector.plugType.toLowerCase(),
    },
    cost:
      item.status === 'COMPLETED' ? { amount: item.totalAmount.toFixed(2), currency: 'BRL' } : null,
    durationSeconds: item.durationSeconds,
    endedAt: new Date(
      new Date(item.startedAt).getTime() + item.durationSeconds * 1000,
    ).toISOString(),
    energyKwh: item.energyKwh,
    failureReason: item.status === 'FAILED' ? 'Falha simulada' : null,
    id: item.id,
    startedAt: item.startedAt,
    station: {
      city: station.address.split('·').at(-1)?.trim() ?? 'São Paulo',
      id: station.id,
      name: station.name,
    },
    status: item.status === 'FAILED' ? 'failed' : 'completed',
    vehicle: {
      brand: vehicle.brand,
      id: vehicle.id,
      model: vehicle.model,
      nickname: vehicle.nickname,
    },
  };
}

function mockDashboardData(query: DashboardQuery): DashboardData {
  const from = query.from ?? '2026-06-01T03:00:00.000Z';
  const to = query.to ?? new Date().toISOString();
  const periodItems = mockHistory
    .map(toMockHistoryItem)
    .filter((item) => {
      const timestamp = new Date(item.startedAt).getTime();
      return timestamp >= new Date(from).getTime() && timestamp <= new Date(to).getTime();
    })
    .filter((item) => !query.vehicleId || item.vehicle.id === query.vehicleId);
  const completed = periodItems.filter((item) => item.status === 'completed');
  const totalCost = completed.reduce((total, item) => total + Number(item.cost?.amount ?? 0), 0);
  return {
    driver: {
      firstName: mockProfile.firstName,
      name: mockProfile.name,
    },
    lastSession: periodItems[0] ?? null,
    mostUsedConnector:
      periodItems.length > 0 ? { sessionCount: periodItems.length, type: 'ccs2' } : null,
    mostUsedStation:
      periodItems.length > 0
        ? {
            city: periodItems[0]!.station.city,
            energyKwh: periodItems.reduce((total, item) => total + item.energyKwh, 0),
            id: periodItems[0]!.station.id,
            name: periodItems[0]!.station.name,
            sessionCount: periodItems.length,
          }
        : null,
    period: {
      from,
      timezone: query.timezone ?? 'America/Sao_Paulo',
      to,
    },
    primaryVehicle: {
      batteryCapacityKwh: mockVehicles[0]!.batteryCapacityKwh,
      brand: mockVehicles[0]!.brand,
      connectorTypes: mockVehicles[0]!.supportedPlugTypes.map((type) => type.toLowerCase()),
      id: mockVehicles[0]!.id,
      model: mockVehicles[0]!.model,
      nickname: mockVehicles[0]!.nickname,
      ...(mockVehicles[0]!.year !== undefined ? { year: mockVehicles[0]!.year } : {}),
    },
    summary: {
      avoidedCo2Kg: null,
      averageDurationSeconds:
        periodItems.length > 0
          ? Math.round(
              periodItems.reduce((total, item) => total + item.durationSeconds, 0) /
                periodItems.length,
            )
          : 0,
      averageEnergyPerSession:
        periodItems.length > 0
          ? periodItems.reduce((total, item) => total + item.energyKwh, 0) / periodItems.length
          : 0,
      cancelledSessions: 0,
      completedSessions: completed.length,
      currency: completed.length > 0 ? 'BRL' : null,
      estimatedSavings: null,
      failedSessions: periodItems.filter((item) => item.status === 'failed').length,
      totalCost: completed.length > 0 ? totalCost.toFixed(2) : null,
      totalDurationSeconds: periodItems.reduce((total, item) => total + item.durationSeconds, 0),
      totalEnergyKwh: periodItems.reduce((total, item) => total + item.energyKwh, 0),
      totalSessions: periodItems.length,
    },
  };
}

export class MockDashboardApi implements DashboardApi {
  async get(query: DashboardQuery = {}): Promise<DashboardData> {
    await wait();
    return mockDashboardData(query);
  }
}

export class MockChargingHistoryApi implements ChargingHistoryApi {
  async list(filters: ChargingHistoryFilters, cursor?: string): Promise<ChargingHistoryPage> {
    await wait();
    let items = mockHistory.map(toMockHistoryItem);
    if (filters.from) {
      const from = new Date(filters.from).getTime();
      items = items.filter((item) => new Date(item.startedAt).getTime() >= from);
    }
    if (filters.to) {
      const to = new Date(filters.to).getTime();
      items = items.filter((item) => new Date(item.startedAt).getTime() <= to);
    }
    if (filters.vehicleId) {
      items = items.filter((item) => item.vehicle.id === filters.vehicleId);
    }
    if (filters.stationId) {
      items = items.filter((item) => item.station.id === filters.stationId);
    }
    if (filters.connectorType) {
      items = items.filter((item) => item.connector.type === filters.connectorType?.toLowerCase());
    }
    if (filters.withCost !== undefined) {
      items = items.filter((item) => Boolean(item.cost) === filters.withCost);
    }
    if (filters.failuresOnly) {
      items = items.filter((item) => item.status === 'failed');
    }
    if (filters.completedOnly) {
      items = items.filter((item) => item.status === 'completed');
    }
    if (filters.status) {
      items = items.filter((item) => item.status === filters.status);
    }
    if (filters.search) {
      const search = filters.search.toLocaleLowerCase('pt-BR');
      items = items.filter(
        (item) =>
          item.station.name.toLocaleLowerCase('pt-BR').includes(search) ||
          item.station.city.toLocaleLowerCase('pt-BR').includes(search),
      );
    }
    items = [...items].sort((left, right) => {
      const direction = filters.sort.endsWith('_ASC') ? 1 : -1;
      if (filters.sort.startsWith('ENERGY')) {
        return direction * (left.energyKwh - right.energyKwh);
      }
      if (filters.sort.startsWith('DURATION')) {
        return direction * (left.durationSeconds - right.durationSeconds);
      }
      if (filters.sort.startsWith('COST')) {
        const leftCost = left.cost ? Number(left.cost.amount) : null;
        const rightCost = right.cost ? Number(right.cost.amount) : null;
        if (leftCost === null && rightCost === null) return 0;
        if (leftCost === null) return 1;
        if (rightCost === null) return -1;
        return direction * (leftCost - rightCost);
      }
      return filters.sort === 'OLDEST'
        ? left.startedAt.localeCompare(right.startedAt)
        : right.startedAt.localeCompare(left.startedAt);
    });
    if (cursor && !/^mock:\d+$/.test(cursor)) {
      throw new Error('Cursor de histórico inválido.');
    }
    const offset = cursor?.startsWith('mock:') ? Number(cursor.slice('mock:'.length)) : 0;
    const limit = filters.limit ?? 20;
    const pageItems = items.slice(offset, offset + limit);
    const nextOffset = offset + pageItems.length;
    return {
      items: pageItems,
      pageInfo: {
        endCursor: nextOffset < items.length ? `mock:${nextOffset}` : null,
        hasNextPage: nextOffset < items.length,
      },
    };
  }

  async getDetails(sessionId: string): Promise<ChargingSessionDetails> {
    await wait();
    const item = mockHistory.map(toMockHistoryItem).find((candidate) => candidate.id === sessionId);
    if (!item) throw new Error('Sessão não encontrada.');
    return {
      ...item,
      audit: {
        createdAt: item.startedAt,
        updatedAt: item.endedAt ?? item.startedAt,
        version: 1,
      },
      chargePoint: {
        externalCode: 'CP-SOLIS-001',
        id: ids.chargePointOne,
        name: 'Carregador principal',
      },
      connector: {
        ...item.connector,
        code: 'SOLIS-001-A',
        number: 1,
      },
      evse: { id: ids.evseOne, uid: 'EVSE-CP-SOLIS-001' },
      meter: {
        startWh: '1000',
        stopWh: String(1000 + item.energyKwh * 1000),
      },
      power: { averagePowerKw: 42, maximumPowerKw: 74 },
      station: {
        ...item.station,
        address: 'Av. Ipiranga, 320',
        latitude: -23.55052,
        longitude: -46.633308,
      },
      stopReason: item.failureReason,
      tariff: item.cost
        ? {
            activationFee: '0.00',
            currency: item.cost.currency,
            name: 'Tarifa padrão',
            parkingFeeHour: '0.00',
            pricePerKwh: '2.1900',
          }
        : null,
    };
  }

  async getTimeline(sessionId: string): Promise<ChargingSessionTimelineData> {
    const details = await this.getDetails(sessionId);
    return {
      events: [
        { occurredAt: details.startedAt, type: 'created' },
        { occurredAt: details.startedAt, type: 'authorized' },
        { occurredAt: details.startedAt, type: 'charging_started' },
        {
          occurredAt: details.endedAt ?? details.startedAt,
          type: details.status === 'failed' ? 'failed' : 'completed',
        },
      ],
      sessionId,
    };
  }

  async getMetrics(sessionId: string): Promise<ChargingSessionMetricsData> {
    const details = await this.getDetails(sessionId);
    return {
      points: [],
      sessionId,
      summary: {
        averagePowerKw: details.power.averagePowerKw,
        maximumPowerKw: details.power.maximumPowerKw,
        originalPointCount: 0,
        returnedPointCount: 0,
      },
    };
  }
}

export class MockVehiclesApi implements VehiclesApi {
  async list(filters: VehicleListFilters = {}): Promise<Vehicle[]> {
    await wait();
    return filterAndSortVehicles(vehicleState, filters);
  }

  async getById(vehicleId: string): Promise<Vehicle> {
    await wait();
    return this.requireVehicle(vehicleId);
  }

  async create(input: VehicleCreateInput): Promise<Vehicle> {
    await wait();
    this.assertNoDuplicate(input);
    const now = new Date().toISOString();
    const vehicle: Vehicle = {
      ...input,
      id: `vehicle-${Date.now()}`,
      userId: ids.user,
      isDefault: input.isDefault || vehicleState.length === 0,
      recordVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    vehicleState = vehicle.isDefault
      ? [...vehicleState.map((item) => ({ ...item, isDefault: false })), vehicle]
      : [...vehicleState, vehicle];
    return vehicle;
  }

  async update(vehicleId: string, input: VehicleUpdateInput): Promise<Vehicle> {
    await wait();
    const current = this.requireVehicle(vehicleId);
    if (current.recordVersion !== input.recordVersion) {
      throw new Error('O veículo foi alterado. Atualize e tente novamente.');
    }
    if (current.isDefault && input.isDefault === false) {
      throw new Error('Defina outro veículo como principal primeiro.');
    }
    this.assertNoDuplicate(input, vehicleId);
    const updated: Vehicle = {
      ...current,
      ...input,
      id: current.id,
      recordVersion: current.recordVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    vehicleState = vehicleState.map((item) => {
      if (input.isDefault && item.id !== vehicleId) {
        return {
          ...item,
          isDefault: false,
          recordVersion: item.recordVersion + 1,
        };
      }
      return item.id === vehicleId ? updated : item;
    });
    return updated;
  }

  setDefault(vehicleId: string, recordVersion: number): Promise<Vehicle> {
    return this.update(vehicleId, { isDefault: true, recordVersion });
  }

  async duplicate(vehicleId: string, recordVersion: number): Promise<Vehicle> {
    const current = await this.getById(vehicleId);
    if (current.recordVersion !== recordVersion) {
      throw new Error('O veículo foi alterado. Atualize e tente novamente.');
    }
    return this.create({
      batteryCapacityKwh: current.batteryCapacityKwh,
      brand: current.brand,
      ...(current.estimatedRangeKm !== undefined
        ? { estimatedRangeKm: current.estimatedRangeKm }
        : {}),
      isDefault: false,
      model: current.model,
      nickname: `${current.nickname} (cópia)`,
      status: 'ACTIVE',
      supportedPlugTypes: current.supportedPlugTypes,
      vehicleType: current.vehicleType,
      ...(current.year !== undefined ? { year: current.year } : {}),
      ...(current.averageConsumptionKwhPer100Km !== undefined
        ? { averageConsumptionKwhPer100Km: current.averageConsumptionKwhPer100Km }
        : {}),
      ...(current.color ? { color: current.color } : {}),
      ...(current.imageUrl ? { imageUrl: current.imageUrl } : {}),
      ...(current.maximumAcPowerKw !== undefined
        ? { maximumAcPowerKw: current.maximumAcPowerKw }
        : {}),
      ...(current.maximumDcPowerKw !== undefined
        ? { maximumDcPowerKw: current.maximumDcPowerKw }
        : {}),
      ...(current.notes ? { notes: current.notes } : {}),
      ...(current.version ? { version: current.version } : {}),
    });
  }

  async remove(vehicleId: string, recordVersion: number): Promise<void> {
    await wait();
    const current = this.requireVehicle(vehicleId);
    if (current.recordVersion !== recordVersion) {
      throw new Error('O veículo foi alterado. Atualize e tente novamente.');
    }
    vehicleState = vehicleState.filter((item) => item.id !== vehicleId);
    if (current.isDefault && vehicleState[0]) {
      vehicleState[0] = {
        ...vehicleState[0],
        isDefault: true,
        recordVersion: vehicleState[0].recordVersion + 1,
      };
    }
  }

  private requireVehicle(vehicleId: string): Vehicle {
    const vehicle = vehicleState.find((item) => item.id === vehicleId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    return vehicle;
  }

  private assertNoDuplicate(
    input: Pick<VehicleCreateInput, 'licensePlate' | 'vin'>,
    excludeId?: string,
  ): void {
    const licensePlate = input.licensePlate?.toUpperCase();
    const vin = input.vin?.toUpperCase();
    const duplicate = vehicleState.some(
      (vehicle) =>
        vehicle.id !== excludeId &&
        ((licensePlate && vehicle.licensePlate?.toUpperCase() === licensePlate) ||
          (vin && vehicle.vin?.toUpperCase() === vin)),
    );
    if (duplicate) throw new Error('Já existe um veículo com esta placa ou VIN.');
  }
}
export class MockPaymentsApi implements PaymentsApi {
  private nextId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async list(): Promise<PaymentMethod[]> {
    await wait();
    return [...paymentState];
  }

  async createMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
    await wait();
    const method: PaymentMethod = {
      id: this.nextId('payment-method'),
      type: input.type === 'CARD' ? 'CREDIT_CARD' : input.type,
      label:
        input.type === 'CARD'
          ? `${input.brand ?? 'Cartão'} final ${input.lastFour ?? '4242'}`
          : input.type === 'PIX'
            ? 'Pix'
            : 'Carteira Solis',
      ...(input.brand ? { brand: input.brand } : {}),
      ...(input.lastFour ? { lastFour: input.lastFour } : {}),
      ...(input.expirationMonth && input.expirationYear
        ? { expiry: `${String(input.expirationMonth).padStart(2, '0')}/${String(input.expirationYear).slice(-2)}` }
        : {}),
      status: 'ACTIVE',
      isDefault: input.isDefault ?? paymentState.length === 0,
    };
    if (method.isDefault) paymentState = paymentState.map((item) => ({ ...item, isDefault: false }));
    paymentState = [method, ...paymentState];
    return method;
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

  async getWallet(): Promise<Wallet> {
    await wait();
    return { ...walletState };
  }

  async listWalletTransactions(cursor?: string): Promise<WalletTransactionPage> {
    await wait();
    const start = cursor ? Number(cursor) : 0;
    const items = walletTransactions.slice(start, start + 20);
    const next = start + items.length;
    return { items, nextCursor: next < walletTransactions.length ? String(next) : null };
  }

  async createTopUp(input: CreateTopUpInput): Promise<PaymentIntent> {
    await wait();
    if (!/^\d+$/.test(input.amountMinor) || BigInt(input.amountMinor) < 5000n) {
      throw new Error('A recarga mínima é R$ 50,00.');
    }
    const replay = [...mockPaymentIntents.values()].find(
      (intent) => intent.metadata?.scenario === `key:${input.idempotencyKey}`,
    );
    if (replay) {
      if (replay.amountMinor !== input.amountMinor) {
        throw new Error('Esta chave de idempotência já foi usada com outro valor.');
      }
      return { ...replay };
    }
    const now = new Date();
    const id = this.nextId('payment');
    const intent: PaymentIntent & { polls: number; credited: boolean } = {
      amountMinor: input.amountMinor,
      authorizedAmountMinor: '0',
      capturedAmountMinor: '0',
      createdAt: now.toISOString(),
      currency: input.currency,
      expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
      id,
      isTerminal: false,
      metadata: {
        copyPasteCode: `SOLIS.PIX.MOCK.${id}.${input.amountMinor}`,
        qrPayload: `000201SOLIS${id}`,
        scenario: `key:${input.idempotencyKey}`,
      },
      refundedAmountMinor: '0',
      status: input.scenario === 'declined' ? 'FAILED' : 'PENDING',
      type: 'WALLET_TOP_UP',
      updatedAt: now.toISOString(),
      polls: 0,
      credited: false,
    };
    intent.isTerminal = intent.status === 'FAILED';
    mockPaymentIntents.set(id, intent);
    return { ...intent };
  }

  async getTopUp(paymentId: string): Promise<PaymentIntent> {
    await wait();
    const intent = mockPaymentIntents.get(paymentId);
    if (!intent) throw new Error('Pagamento não encontrado.');
    intent.polls = (intent.polls ?? 0) + 1;
    if (intent.status === 'PENDING' && intent.polls >= 2) {
      intent.status = 'CAPTURED';
      intent.capturedAmountMinor = intent.amountMinor;
      intent.isTerminal = true;
      intent.updatedAt = new Date().toISOString();
      if (!intent.credited) {
        intent.credited = true;
        walletState = {
          ...walletState,
          availableBalanceMinor: (
            BigInt(walletState.availableBalanceMinor) + BigInt(intent.amountMinor)
          ).toString(),
          updatedAt: intent.updatedAt,
          version: walletState.version + 1,
        };
        walletTransactions = [
          {
            amountMinor: intent.amountMinor,
            chargingSessionId: null,
            createdAt: intent.updatedAt,
            currency: intent.currency,
            description: 'Recarga Pix da carteira Solis',
            direction: 'CREDIT',
            id: this.nextId('wallet-transaction'),
            paymentIntentId: intent.id,
            status: 'POSTED',
            type: 'TOP_UP',
          },
          ...walletTransactions,
        ];
      }
    }
    return { ...intent };
  }

  getPayment(paymentId: string): Promise<PaymentIntent> {
    return this.getTopUp(paymentId);
  }

  async cancelPayment(paymentId: string): Promise<PaymentIntent> {
    await wait();
    const intent = mockPaymentIntents.get(paymentId);
    if (!intent) throw new Error('Pagamento não encontrado.');
    if (intent.status !== 'PENDING') throw new Error('Este pagamento não pode ser cancelado.');
    intent.status = 'CANCELLED';
    intent.isTerminal = true;
    intent.updatedAt = new Date().toISOString();
    return { ...intent };
  }

  async getAutoRecharge(): Promise<AutoRechargeRule> {
    await wait();
    return { ...autoRechargeState };
  }

  async updateAutoRecharge(
    input: import('./contracts').UpdateAutoRechargeInput,
  ): Promise<AutoRechargeRule> {
    await wait();
    if (input.enabled && !input.consentConfirmed) {
      throw new Error('Confirme o consentimento para ativar a recarga automática.');
    }
    autoRechargeState = {
      ...autoRechargeState,
      enabled: input.enabled,
      currency: input.currency,
      id: autoRechargeState.id ?? this.nextId('auto-recharge'),
      minimumBalanceMinor: input.minimumBalanceMinor,
      paymentMethodId: input.paymentMethodId,
      rechargeAmountMinor: input.rechargeAmountMinor,
    };
    return { ...autoRechargeState };
  }

  async disableAutoRecharge(): Promise<AutoRechargeRule> {
    await wait();
    autoRechargeState = { ...autoRechargeState, enabled: false };
    return { ...autoRechargeState };
  }

  async createMockPix(amount: number): Promise<{ code: string; expiresAt: string }> {
    const intent = await this.createTopUp({
      amountMinor: String(Math.round(amount * 100)),
      currency: 'BRL',
      idempotencyKey: `legacy-mobile-pix-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method: 'PIX',
    });
    const code = intent.metadata?.copyPasteCode;
    if (!code || !intent.expiresAt) {
      throw new Error('O provedor não retornou os dados do Pix.');
    }
    return { code, expiresAt: intent.expiresAt };
  }

  async getReceipt(chargingSessionId: string): Promise<ChargingReceipt> {
    await wait();
    const session = mockHistory.find((item) => item.id === chargingSessionId);
    if (!session) throw new Error('Recibo não encontrado.');
    const completedAt = new Date(
      new Date(session.startedAt).getTime() + session.durationSeconds * 1000,
    ).toISOString();
    return {
      amountMinor: String(Math.round(session.totalAmount * 100)),
      chargingSession: {
        completedAt,
        connector: 'Conector de demonstração',
        durationSeconds: session.durationSeconds,
        energyKwh: session.energyKwh.toFixed(3),
        id: session.id,
        startedAt: session.startedAt,
        station: session.stationName,
        stoppedAt: completedAt,
        tariffSnapshot: null,
        vehicle: {
          brand: 'Solis',
          model: 'Veículo de demonstração',
          plate: null,
        },
      },
      currency: 'BRL',
      issuedAt: completedAt,
      payment: { id: `mock-${session.id}`, method: 'solis-wallet', reference: null, status: 'CAPTURED' },
      receiptNumber: `SOLIS-MOCK-${session.id.slice(-6).toUpperCase()}`,
      status: 'ISSUED',
    };
  }
}

export class MockRoutePlannerProvider implements RoutePlannerProvider {
  async calculateRoute(input: RoutePlannerInput): Promise<RoutePlannerResult> {
    await wait(450);
    const vehicle = vehicleState.find((item) => item.id === input.vehicleId);
    if (!vehicle) throw new Error('Selecione um veículo válido.');

    const distanceKm = input.priority === 'SHORTEST_TIME' ? 326 : 311;
    const consumptionPerKm = (vehicle.averageConsumptionKwhPer100Km ?? 17) / 100;
    const estimatedConsumptionKwh = Number((distanceKm * consumptionPerKm).toFixed(1));

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
    dashboard: new MockDashboardApi(),
    history: new MockChargingHistoryApi(),
    stations: new MockStationsApi(),
    charging: new MockChargingApi(),
    vehicles: new MockVehiclesApi(),
    payments: new MockPaymentsApi(),
    routePlanner: new MockRoutePlannerProvider(),
  };
}
