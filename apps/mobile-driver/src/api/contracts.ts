import type { ChargeQrPayload } from '@/utils/qr-parser';
import type {
  AuthSession,
  AuthTokens,
  ChargingHistoryItem,
  ChargingSession,
  ChargingSummary,
  PaymentMethod,
  Reservation,
  RoutePlannerInput,
  LoginInput,
  RegisterInput,
  RoutePlannerResult,
  Station,
  StationFilters,
  UserProfile,
  ValidatedConnector,
  Vehicle,
} from '@/types/domain';

export interface AuthApi {
  register(input: RegisterInput): Promise<AuthSession>;
  login(input: LoginInput): Promise<AuthSession>;
  refresh(refreshToken: string): Promise<AuthTokens>;
}

export interface UsersApi {
  getMe(): Promise<UserProfile>;
}

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
  validateQr(payload: ChargeQrPayload): Promise<ValidatedConnector>;
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
  auth: AuthApi;
  users: UsersApi;
  stations: StationsApi;
  charging: ChargingApi;
  vehicles: VehiclesApi;
  payments: PaymentsApi;
  routePlanner: RoutePlannerProvider;
}
