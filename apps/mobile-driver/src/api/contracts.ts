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

export interface StationsApi {
  getNearby(filters: StationFilters): Promise<Station[]>;
  getById(stationId: string): Promise<Station>;
  createReservation(stationId: string, connectorId: string): Promise<Reservation>;
  listReservations(): Promise<Reservation[]>;
}

export interface StartChargingInput {
  validatedConnector: ValidatedConnector;
  vehicleId: string;
  paymentMethodId: string;
  idempotencyKey: string;
}

export interface ChargingApi {
  validateQr(rawValue: string): Promise<ValidatedConnector>;
  validateManualCode(code: string): Promise<ValidatedConnector>;
  start(input: StartChargingInput): Promise<ChargingSession>;
  getActive(): Promise<ChargingSession | null>;
  getById(sessionId: string): Promise<ChargingSession>;
  stop(sessionId: string): Promise<ChargingSummary>;
  getHistory(): Promise<ChargingHistoryItem[]>;
}

export interface VehiclesApi {
  list(): Promise<Vehicle[]>;
  create(input: Omit<Vehicle, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Vehicle>;
  update(vehicleId: string, input: Partial<Vehicle>): Promise<Vehicle>;
}

export interface PaymentsApi {
  list(): Promise<PaymentMethod[]>;
  setDefault(paymentMethodId: string): Promise<PaymentMethod[]>;
  remove(paymentMethodId: string): Promise<void>;
  createMockPix(amount: number): Promise<{ code: string; expiresAt: string }>;
}

export interface RoutePlannerProvider {
  calculateRoute(input: RoutePlannerInput): Promise<RoutePlannerResult>;
}

export interface ApiClients {
  stations: StationsApi;
  charging: ChargingApi;
  vehicles: VehiclesApi;
  payments: PaymentsApi;
  routePlanner: RoutePlannerProvider;
}
