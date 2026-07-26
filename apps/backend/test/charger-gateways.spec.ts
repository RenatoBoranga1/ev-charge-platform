/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { ChargerProtocol } from '@solis/database';

import type { PrismaService } from '../src/database/prisma.service';
import { Ocpp16ChargerGateway } from '../src/charging/gateway/ocpp16-charger.gateway';
import { RoutingChargerGateway } from '../src/charging/gateway/routing-charger.gateway';
import type { SimulatorChargerGateway } from '../src/charging/gateway/simulator-charger.gateway';
import type { Ocpp16CentralSystemService } from '../src/ocpp/ocpp16-central-system.service';

describe('charging gateway adapters', () => {
  it('maps the generic gateway contract to the OCPP central system', async () => {
    const central = {
      assertConnectorConnected: jest.fn().mockResolvedValue(undefined),
      startSession: jest.fn().mockResolvedValue({ meterStartWh: 10n, powerKw: 3 }),
      stopSession: jest.fn().mockResolvedValue(20n),
    } as unknown as Ocpp16CentralSystemService;
    const gateway = new Ocpp16ChargerGateway(central);
    const command = {
      callbackUrl: 'http://internal',
      connectorId: 'connector',
      maximumPowerKw: 22,
      sessionId: 'session',
    };

    await expect(
      gateway.registerConnector({
        connectorId: 'connector',
        maximumPowerKw: 22,
        status: 'AVAILABLE',
      }),
    ).resolves.toBeUndefined();
    await expect(gateway.start(command)).resolves.toEqual({
      meterStartWh: 10n,
      powerKw: 3,
    });
    await expect(gateway.stop('session')).resolves.toEqual({ meterStopWh: 20n });
    expect(central.assertConnectorConnected).toHaveBeenCalledWith('connector');
    expect(central.startSession).toHaveBeenCalledWith('connector', 'session');
    expect(central.stopSession).toHaveBeenCalledWith('session');
  });

  it('routes connector and session commands by persisted protocol', async () => {
    const prisma = {
      chargingSession: { findUnique: jest.fn() },
      connector: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const simulator = {
      registerConnector: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue({ meterStartWh: 1n, powerKw: 2 }),
      stop: jest.fn().mockResolvedValue({ meterStopWh: 3n }),
    } as unknown as SimulatorChargerGateway;
    const ocpp = {
      registerConnector: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue({ meterStartWh: 4n, powerKw: 5 }),
      stop: jest.fn().mockResolvedValue({ meterStopWh: 6n }),
    } as unknown as Ocpp16ChargerGateway;
    const gateway = new RoutingChargerGateway(prisma, simulator, ocpp);
    const command = {
      callbackUrl: 'http://internal',
      connectorId: 'connector',
      maximumPowerKw: 22,
      sessionId: 'session',
    };

    jest.mocked(prisma.connector.findUnique)
      .mockResolvedValueOnce({
        evse: { chargePoint: { protocol: ChargerProtocol.SIMULATOR } },
      } as never)
      .mockResolvedValueOnce({
        evse: { chargePoint: { protocol: ChargerProtocol.OCPP16 } },
      } as never);
    await gateway.registerConnector({
      connectorId: 'connector',
      maximumPowerKw: 22,
      status: 'AVAILABLE',
    });
    await expect(gateway.start(command)).resolves.toEqual({
      meterStartWh: 4n,
      powerKw: 5,
    });
    expect(simulator.registerConnector).toHaveBeenCalled();
    expect(ocpp.start).toHaveBeenCalledWith(command);

    jest.mocked(prisma.chargingSession.findUnique)
      .mockResolvedValueOnce({ chargePoint: { protocol: ChargerProtocol.SIMULATOR } } as never)
      .mockResolvedValueOnce({ chargePoint: { protocol: ChargerProtocol.OCPP16 } } as never);
    await expect(gateway.stop('simulator-session')).resolves.toEqual({ meterStopWh: 3n });
    await expect(gateway.stop('ocpp-session')).resolves.toEqual({ meterStopWh: 6n });
  });

  it('rejects missing connectors and sessions', async () => {
    const prisma = {
      chargingSession: { findUnique: jest.fn().mockResolvedValue(null) },
      connector: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const gateway = new RoutingChargerGateway(
      prisma,
      {} as SimulatorChargerGateway,
      {} as Ocpp16ChargerGateway,
    );

    await expect(
      gateway.registerConnector({
        connectorId: 'missing',
        maximumPowerKw: 22,
        status: 'AVAILABLE',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(gateway.stop('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});