import { Injectable } from '@nestjs/common';

import { Ocpp16CentralSystemService } from '../../ocpp/ocpp16-central-system.service';
import {
  ChargerGateway,
  type RegisterConnectorCommand,
  type StartChargeCommand,
  type StartChargeResult,
  type StopChargeResult,
} from './charger-gateway';

@Injectable()
export class Ocpp16ChargerGateway extends ChargerGateway {
  constructor(private readonly centralSystem: Ocpp16CentralSystemService) {
    super();
  }

  async registerConnector(command: RegisterConnectorCommand): Promise<void> {
    await this.centralSystem.assertConnectorConnected(command.connectorId);
  }

  start(command: StartChargeCommand): Promise<StartChargeResult> {
    return this.centralSystem.startSession(command.connectorId, command.sessionId);
  }

  async stop(sessionId: string): Promise<StopChargeResult> {
    return { meterStopWh: await this.centralSystem.stopSession(sessionId) };
  }
}