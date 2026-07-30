import type { ChargeQrPayload } from '@/utils/qr-parser';
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
  AutoRechargeRule,
  ChargingReceipt,
  PaymentIntent,
  Wallet,
  WalletTransactionPage,
  PaymentMethod,
  Reservation,
  RoutePlannerInput,
  LoginInput,
  UpdateProfileInput,
  RegisterInput,
  RoutePlannerResult,
  Station,
  StationFilters,
  UserProfile,
  ValidatedConnector,
  VehicleCreateInput,
  VehicleListFilters,
  VehicleUpdateInput,
  Vehicle,
} from '@/types/domain';

export interface AuthApi {
  register(input: RegisterInput): Promise<AuthSession>;
  login(input: LoginInput): Promise<AuthSession>;
  refresh(refreshToken: string): Promise<AuthTokens>;
}

export interface UsersApi {
  getMe(): Promise<UserProfile>;
  update(input: UpdateProfileInput): Promise<UserProfile>;
  requestDeletion(recordVersion: number): Promise<UserProfile>;
}

export interface NearbyStationsOptions {
  latitude: number;
  longitude: number;
  signal?: AbortSignal;
}

export interface StationsApi {
  getNearby(filters: StationFilters, options?: NearbyStationsOptions): Promise<Station[]>;
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
  getMetrics(sessionId: string): Promise<ChargingSessionRealtimeEvent>;
  stop(sessionId: string, idempotencyKey: string): Promise<ChargingSummary>;
}

export interface DashboardApi {
  get(query?: DashboardQuery, signal?: AbortSignal): Promise<DashboardData>;
}

export interface ChargingHistoryApi {
  list(
    filters: ChargingHistoryFilters,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<ChargingHistoryPage>;
  getDetails(sessionId: string, signal?: AbortSignal): Promise<ChargingSessionDetails>;
  getTimeline(sessionId: string, signal?: AbortSignal): Promise<ChargingSessionTimelineData>;
  getMetrics(
    sessionId: string,
    maxPoints?: number,
    signal?: AbortSignal,
  ): Promise<ChargingSessionMetricsData>;
}

export interface VehiclesApi {
  list(filters?: VehicleListFilters): Promise<Vehicle[]>;
  getById(vehicleId: string): Promise<Vehicle>;
  create(input: VehicleCreateInput): Promise<Vehicle>;
  update(vehicleId: string, input: VehicleUpdateInput): Promise<Vehicle>;
  setDefault(vehicleId: string, recordVersion: number): Promise<Vehicle>;
  duplicate(vehicleId: string, recordVersion: number): Promise<Vehicle>;
  remove(vehicleId: string, recordVersion: number): Promise<void>;
}

export interface CreatePaymentMethodInput {
  brand?: string;
  expirationMonth?: number;
  expirationYear?: number;
  isDefault?: boolean;
  lastFour?: string;
  type: 'CARD' | 'PIX' | 'WALLET';
}

export interface CreateTopUpInput {
  amountMinor: string;
  currency: 'BRL';
  idempotencyKey: string;
  method: 'PIX';
  scenario?: 'approved' | 'pending' | 'declined' | 'timeout' | 'expired' | 'delayed-confirmation';
}

export interface UpdateAutoRechargeInput {
  consentConfirmed: boolean;
  currency: 'BRL';
  enabled: boolean;
  minimumBalanceMinor: string;
  paymentMethodId: string;
  rechargeAmountMinor: string;
}

export interface PaymentsApi {
  list(): Promise<PaymentMethod[]>;
  createMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod>;
  setDefault(paymentMethodId: string): Promise<PaymentMethod[]>;
  remove(paymentMethodId: string): Promise<void>;
  getWallet(): Promise<Wallet>;
  listWalletTransactions(cursor?: string): Promise<WalletTransactionPage>;
  createTopUp(input: CreateTopUpInput): Promise<PaymentIntent>;
  getTopUp(paymentId: string): Promise<PaymentIntent>;
  getPayment(paymentId: string): Promise<PaymentIntent>;
  cancelPayment(paymentId: string): Promise<PaymentIntent>;
  getAutoRecharge(): Promise<AutoRechargeRule>;
  updateAutoRecharge(input: UpdateAutoRechargeInput): Promise<AutoRechargeRule>;
  disableAutoRecharge(): Promise<AutoRechargeRule>;
  createMockPix(amount: number): Promise<{ code: string; expiresAt: string }>;
  getReceipt(chargingSessionId: string): Promise<ChargingReceipt>;
}

export interface RoutePlannerProvider {
  calculateRoute(input: RoutePlannerInput): Promise<RoutePlannerResult>;
}

export interface ApiClients {
  auth: AuthApi;
  users: UsersApi;
  dashboard: DashboardApi;
  history: ChargingHistoryApi;
  stations: StationsApi;
  charging: ChargingApi;
  vehicles: VehiclesApi;
  payments: PaymentsApi;
  routePlanner: RoutePlannerProvider;
}
