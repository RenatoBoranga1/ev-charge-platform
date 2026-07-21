import { ChargingSessionStatus } from '@solis/database';

import {
  toChargingSessionDto,
  type ChargingSessionRecord,
} from '../src/charging/charging-session.presenter';

describe('charging session presenter', () => {
  it('exposes id and sessionId for REST and realtime consumers', () => {
    const createdAt = new Date('2026-07-21T10:00:00.000Z');
    const session = {
      chargePointId: 'charge-point-id',
      completedAt: null,
      connector: { maximumPowerKw: 22, plugType: 'TYPE_2' },
      connectorId: 'connector-id',
      createdAt,
      currentPowerKw: 0,
      energyKwh: 0,
      evseId: 'evse-id',
      failureReason: null,
      id: 'session-id',
      startedAt: null,
      station: { name: 'Solis Centro' },
      stationId: 'station-id',
      status: ChargingSessionStatus.AUTHORIZED,
      stoppedAt: null,
      tariffSnapshot: {
        activationFee: 1,
        currency: 'BRL',
        initialBatteryPercent: 30,
        parkingFeeHour: 0,
        pricePerKwh: 2,
      },
      totalAmount: 0,
      vehicle: { batteryCapacityKwh: 60 },
      vehicleId: 'vehicle-id',
      version: 1,
    } as unknown as ChargingSessionRecord;

    expect(toChargingSessionDto(session)).toMatchObject({
      id: 'session-id',
      sessionId: 'session-id',
      status: 'authorized',
    });
  });
});
