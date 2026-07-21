export type SimulatedConnectorStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'OFFLINE'
  | 'FAULTED';

export interface RegisterConnectorCommand {
  connectorId: string;
  maximumPowerKw: number;
  status: SimulatedConnectorStatus;
}

export interface StartChargeCommand {
  callbackUrl: string;
  connectorId: string;
  maximumPowerKw: number;
  scenario?: string;
  sessionId: string;
}

export interface StartChargeResult {
  meterStartWh: bigint;
  powerKw: number;
}

export interface StopChargeResult {
  meterStopWh: bigint;
}

export abstract class ChargerGateway {
  abstract registerConnector(command: RegisterConnectorCommand): Promise<void>;
  abstract start(command: StartChargeCommand): Promise<StartChargeResult>;
  abstract stop(sessionId: string): Promise<StopChargeResult>;
}
