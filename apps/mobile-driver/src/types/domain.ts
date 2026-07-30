export type PlugType = 'CCS2' | 'TYPE_2' | 'CHADEMO' | 'NACS' | 'GB_T';
export type VehicleType = 'BEV' | 'PHEV' | 'HEV';
export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'SOLD';
export type ProfileTheme = 'SYSTEM' | 'LIGHT' | 'DARK';

export type CurrentType = 'AC' | 'DC';
export type StationStatus =
  'AVAILABLE' | 'PARTIAL' | 'OCCUPIED' | 'RESERVED' | 'OFFLINE' | 'MAINTENANCE';
export type ChargingUiStatus =
  | 'pending'
  | 'authorized'
  | 'starting'
  | 'charging'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Connector {
  id: string;
  code: string;
  number: number;
  plugType: PlugType;
  currentType: CurrentType;
  maximumPowerKw: number;
  status: StationStatus;
}

export interface Station {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  availableConnectors: number;
  totalConnectors: number;
  maximumPowerKw: number;
  plugTypes: PlugType[];
  pricePerKwh: number;
  rating: number;
  openingHours: string;
  isOpen24Hours: boolean;
  hasParking: boolean;
  operator: string;
  status: StationStatus;
  connectors: Connector[];
}

export interface StationFilters {
  availability: StationStatus[];
  maximumDistanceKm: number;
  plugTypes: PlugType[];
  minimumPowerKw: number;
  currentTypes: CurrentType[];
  maximumPricePerKwh: number;
  open24HoursOnly: boolean;
  parkingOnly: boolean;
  operator?: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  nickname: string;
  brand: string;
  model: string;
  version?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  vin?: string;
  vehicleType: VehicleType;
  batteryCapacityKwh: number;
  estimatedRangeKm?: number;
  averageConsumptionKwhPer100Km?: number;
  maximumAcPowerKw?: number;
  maximumDcPowerKw?: number;
  supportedPlugTypes: PlugType[];
  isDefault: boolean;
  status: VehicleStatus;
  createdAt: string;
  imageUrl?: string;
  notes?: string;
  recordVersion: number;
  updatedAt: string;
}

export type VehicleCreateInput = Omit<
  Vehicle,
  'id' | 'userId' | 'recordVersion' | 'createdAt' | 'updatedAt'
>;

export type VehicleUpdateInput = Partial<VehicleCreateInput> & {
  recordVersion: number;
};

export interface VehicleListFilters {
  search?: string;
  type?: VehicleType;
  status?: VehicleStatus;
  sortBy?: 'nickname' | 'brand' | 'createdAt' | 'year';
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentMethod {
  id: string;
  type: 'CREDIT_CARD' | 'PIX' | 'WALLET' | 'MOBILITY_TAG';
  label: string;
  brand?: string;
  lastFour?: string;
  expiry?: string;
  holderName?: string;
  status: 'ACTIVE' | 'PENDING' | 'DISABLED';
  isDefault: boolean;
  balance?: number;
}

export interface Wallet {
  availableBalanceMinor: string;
  currency: string;
  id: string;
  reservedBalanceMinor: string;
  status: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
  updatedAt: string;
  version: number;
}

export type WalletTransactionType =
  | 'TOP_UP'
  | 'AUTHORIZATION'
  | 'CAPTURE'
  | 'RELEASE'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'AUTO_RECHARGE'
  | 'REVERSAL';

export interface WalletTransaction {
  amountMinor: string;
  chargingSessionId: string | null;
  createdAt: string;
  currency: string;
  description: string;
  direction: 'CREDIT' | 'DEBIT';
  id: string;
  paymentIntentId: string | null;
  status: 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';
  type: WalletTransactionType;
}

export interface WalletTransactionPage {
  items: WalletTransaction[];
  nextCursor: string | null;
}

export type PaymentIntentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'REQUIRES_ACTION'
  | 'AUTHORIZED'
  | 'PROCESSING'
  | 'CAPTURED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'
  | 'REQUIRES_REVIEW'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface PaymentIntent {
  amountMinor: string;
  authorizedAmountMinor: string;
  capturedAmountMinor: string;
  createdAt: string;
  currency: string;
  expiresAt: string | null;
  id: string;
  isTerminal: boolean;
  metadata: {
    copyPasteCode?: string;
    qrPayload?: string;
    scenario?: string;
  } | null;
  refundedAmountMinor: string;
  status: PaymentIntentStatus;
  type: string;
  updatedAt: string;
}

export interface AutoRechargeRule {
  cooldownUntil: string | null;
  currency: string;
  enabled: boolean;
  failureCount: number;
  id: string | null;
  minimumBalanceMinor: string;
  paymentMethodId: string | null;
  rechargeAmountMinor: string;
}

export interface ChargingReceipt {
  amountMinor: string;
  chargingSession: {
    completedAt: string | null;
    connector: string;
    durationSeconds: number;
    energyKwh: string;
    id: string;
    startedAt: string | null;
    station: string;
    stoppedAt: string | null;
    tariffSnapshot: unknown;
    vehicle: {
      brand: string;
      model: string;
      plate: string | null;
    };
  };
  currency: string;
  issuedAt: string;
  payment: {
    id: string;
    method: string;
    reference: string | null;
    status: string;
  };
  receiptNumber: string;
  status: 'ISSUED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
}

export interface ValidatedConnector {
  station: Station;
  connector: Connector;
  estimatedPreauthorization: number;
}

export interface ChargingSession {
  id: string;
  stationId: string;
  stationName: string;
  connectorId: string;
  connectorLabel: string;
  vehicleId: string;
  paymentMethodId: string;
  status: ChargingUiStatus;
  startedAt: string;
  elapsedSeconds: number;
  energyKwh: number;
  currentPowerKw: number;
  estimatedCost: number;
  estimatedBatteryPercent?: number;
  tariffPerKwh: number;
  estimatedEndAt?: string;
}

export interface PriceBreakdown {
  energyAmount: number;
  activationFee: number;
  parkingFee: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface ChargingSummary {
  session: ChargingSession;
  stoppedAt: string;
  durationSeconds: number;
  energyKwh: number;
  paymentMethodId: string;
  price: PriceBreakdown;
  avoidedCo2Kg: number;
}

export interface ChargingSessionRealtimeEvent {
  sessionId: string;
  occurredAt: string;
  status: ChargingUiStatus;
  elapsedSeconds: number;
  energyKwh: number;
  currentPowerKw: number;
  estimatedCost: number;
  estimatedBatteryPercent?: number;
}

export interface MoneyValue {
  amount: string;
  currency: string;
}

export interface DashboardPeriod {
  from: string;
  timezone: string;
  to: string;
}

export interface DashboardQuery {
  from?: string;
  timezone?: string;
  to?: string;
  vehicleId?: string;
}

export interface DashboardData {
  driver: {
    firstName: string;
    name: string;
  };
  period: DashboardPeriod;
  summary: {
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    cancelledSessions: number;
    totalEnergyKwh: number;
    totalDurationSeconds: number;
    totalCost: string | null;
    currency: string | null;
    estimatedSavings: number | null;
    avoidedCo2Kg: number | null;
    averageEnergyPerSession: number;
    averageDurationSeconds: number;
  };
  lastSession: ChargingHistoryItem | null;
  mostUsedStation: {
    id: string;
    name: string;
    city?: string;
    sessionCount: number;
    energyKwh: number;
  } | null;
  mostUsedConnector: {
    type: string;
    sessionCount: number;
  } | null;
  primaryVehicle: {
    id: string;
    nickname: string;
    brand: string;
    model: string;
    year?: number;
    batteryCapacityKwh: number;
    connectorTypes: string[];
  } | null;
}

export type ChargingHistorySort =
  | 'RECENT'
  | 'OLDEST'
  | 'ENERGY_DESC'
  | 'ENERGY_ASC'
  | 'DURATION_DESC'
  | 'DURATION_ASC'
  | 'COST_DESC'
  | 'COST_ASC';

export interface ChargingHistoryFilters extends DashboardQuery {
  connectorType?: PlugType;
  status?: ChargingUiStatus;
  stationId?: string;
  search?: string;
  withCost?: boolean;
  failuresOnly?: boolean;
  completedOnly?: boolean;
  sort: ChargingHistorySort;
  limit?: number;
}

export interface ChargingHistoryItem {
  id: string;
  station: {
    id: string;
    name: string;
    city: string;
  };
  vehicle: {
    id: string;
    nickname: string;
    brand: string;
    model: string;
  };
  connector: {
    id: string;
    label: string;
    type: string;
  };
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  energyKwh: number;
  cost: MoneyValue | null;
  status: ChargingUiStatus;
  failureReason: string | null;
}

export interface ChargingHistoryPage {
  items: ChargingHistoryItem[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface ChargingSessionDetails extends ChargingHistoryItem {
  station: ChargingHistoryItem['station'] & {
    address: string;
    latitude: number;
    longitude: number;
  };
  connector: ChargingHistoryItem['connector'] & {
    code: string;
    number: number;
  };
  chargePoint: {
    id: string;
    externalCode: string;
    name: string | null;
  };
  evse: {
    id: string;
    uid: string;
  };
  meter: {
    startWh: string | null;
    stopWh: string | null;
  };
  power: {
    maximumPowerKw: number | null;
    averagePowerKw: number | null;
  };
  tariff: {
    name: string;
    currency: string;
    pricePerKwh: string;
    activationFee: string;
    parkingFeeHour: string;
  } | null;
  stopReason: string | null;
  audit: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

export type ChargingTimelineEventType =
  | 'created'
  | 'authorized'
  | 'starting'
  | 'charging_started'
  | 'first_measurement'
  | 'stopping'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ChargingSessionTimelineData {
  sessionId: string;
  events: {
    occurredAt: string;
    type: ChargingTimelineEventType;
  }[];
}

export interface ChargingSessionMetricsData {
  sessionId: string;
  points: {
    sampledAt: string;
    accumulatedEnergyKwh: number;
    powerKw: number | null;
  }[];
  summary: {
    averagePowerKw: number | null;
    maximumPowerKw: number | null;
    originalPointCount: number;
    returnedPointCount: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  city?: string;
  state?: string;
  country: string;
  language: string;
  theme: ProfileTheme;
  preferences: {
    dataSaver: boolean;
  };
  notifications: {
    chargingNotifications: boolean;
    emailReceipts: boolean;
    favoriteStationAlerts: boolean;
    promotions: boolean;
    reservationAlerts: boolean;
  };
  privacy: {
    analyticsConsent: boolean;
    marketingConsent: boolean;
    personalizedOffers: boolean;
  };
  accountDeletionRequestedAt?: string;
  recordVersion: number;
  totalEnergyKwh: number;
  avoidedCo2Kg: number;
  chargingSessions: number;
  estimatedSavings: number;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  language?: string;
  theme?: ProfileTheme;
  preferences?: Partial<UserProfile['preferences']>;
  notifications?: Partial<UserProfile['notifications']>;
  privacy?: Partial<UserProfile['privacy']>;
  recordVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthSession {
  user: UserProfile;
  tokens: AuthTokens;
}

export interface RoutePlannerInput {
  origin: string;
  destination: string;
  vehicleId: string;
  currentBatteryPercent: number;
  minimumArrivalBatteryPercent: number;
  preferFastChargers: boolean;
  avoidTolls: boolean;
  avoidOfflineStations: boolean;
  priority: 'LOWEST_COST' | 'SHORTEST_TIME';
}

export interface RouteStop {
  station: Station;
  arrivalBatteryPercent: number;
  chargeDurationMinutes: number;
  departureBatteryPercent: number;
}

export interface RoutePlannerResult {
  distanceKm: number;
  durationMinutes: number;
  estimatedConsumptionKwh: number;
  arrivalBatteryPercent: number;
  stops: RouteStop[];
  estimatedChargingCost: number;
}

export interface Reservation {
  id: string;
  stationName: string;
  connectorLabel: string;
  startsAt: string;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}
