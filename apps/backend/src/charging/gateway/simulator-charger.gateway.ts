import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { environment } from '../../config/environment';
import {
  ChargerGateway,
  type RegisterConnectorCommand,
  type StartChargeCommand,
  type StartChargeResult,
  type StopChargeResult,
} from './charger-gateway';

interface SimulatorStartResponse {
  meterStartWh: string;
  powerKw: number;
}

interface SimulatorStopResponse {
  meterStopWh: string;
}

@Injectable()
export class SimulatorChargerGateway extends ChargerGateway {
  async registerConnector(command: RegisterConnectorCommand): Promise<void> {
    await this.request('/connectors/register', command);
  }

  async start(command: StartChargeCommand): Promise<StartChargeResult> {
    const response = await this.request<SimulatorStartResponse>(
      '/sessions/' + command.sessionId + '/start',
      command,
    );
    return {
      meterStartWh: BigInt(response.meterStartWh),
      powerKw: response.powerKw,
    };
  }

  async stop(sessionId: string): Promise<StopChargeResult> {
    const response = await this.request<SimulatorStopResponse>(
      '/sessions/' + sessionId + '/stop',
      {},
    );
    return { meterStopWh: BigInt(response.meterStopWh) };
  }

  private async request<T = void>(
    path: string,
    body: object,
  ): Promise<T> {
    try {
      const response = await fetch(environment.chargerSimulatorUrl + path, {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'x-simulator-secret': environment.simulatorSecret,
        },
        method: 'POST',
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'simulator rejected request');
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'CHARGER_UNAVAILABLE',
        message:
          error instanceof Error
            ? error.message
            : 'Charger simulator unavailable.',
      });
    }
  }
}
