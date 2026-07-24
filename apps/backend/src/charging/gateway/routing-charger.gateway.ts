import { Injectable, NotFoundException } from '@nestjs/common';
import { ChargerProtocol } from '@solis/database';

import { PrismaService } from '../../database/prisma.service';
import {
  ChargerGateway,
  type RegisterConnectorCommand,
  type StartChargeCommand,
  type StartChargeResult,
  type StopChargeResult,
} from './charger-gateway';
import { Ocpp16ChargerGateway } from './ocpp16-charger.gateway';
import { SimulatorChargerGateway } from './simulator-charger.gateway';

@Injectable()
export class RoutingChargerGateway extends ChargerGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulator: SimulatorChargerGateway,
    private readonly ocpp16: Ocpp16ChargerGateway,
  ) {
    super();
  }

  async registerConnector(command: RegisterConnectorCommand): Promise<void> {
    const gateway = await this.forConnector(command.connectorId);
    await gateway.registerConnector(command);
  }

  async start(command: StartChargeCommand): Promise<StartChargeResult> {
    return (await this.forConnector(command.connectorId)).start(command);
  }

  async stop(sessionId: string): Promise<StopChargeResult> {
    const session = await this.prisma.chargingSession.findUnique({
      include: { chargePoint: true },
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Sessao nao encontrada.');
    return this.byProtocol(session.chargePoint.protocol).stop(sessionId);
  }

  private async forConnector(connectorId: string): Promise<ChargerGateway> {
    const connector = await this.prisma.connector.findUnique({
      include: { evse: { include: { chargePoint: true } } },
      where: { id: connectorId },
    });
    if (!connector) throw new NotFoundException('Conector nao encontrado.');
    return this.byProtocol(connector.evse.chargePoint.protocol);
  }

  private byProtocol(protocol: ChargerProtocol): ChargerGateway {
    return protocol === ChargerProtocol.OCPP16 ? this.ocpp16 : this.simulator;
  }
}