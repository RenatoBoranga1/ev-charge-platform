export type PlugType = 'CCS2' | 'TYPE_2' | 'CHADEMO' | 'GB_T';
export type CurrentType = 'AC' | 'DC';
export type StationStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'OFFLINE'
  | 'MAINTENANCE';
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
  brand: string;
  model: string;
  version?: string;
  year?: number;
  licensePlate?: string;
  vehicleType: 'BEV' | 'PHEV';
  batteryCapacityKwh: number;
  estimatedRangeKm?: number;
  averageConsumptionKwhPer100Km?: number;
  supportedPlugTypes: PlugType[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  totalEnergyKwh: number;
  avoidedCo2Kg: number;
  chargingSessions: number;
  estimatedSavings: number;
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
export interface ChargingHistoryItem {
  id: string;
  stationName: string;
  startedAt: string;
  durationSeconds: number;
  energyKwh: number;
  totalAmount: number;
  paymentLabel: string;
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED';
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
