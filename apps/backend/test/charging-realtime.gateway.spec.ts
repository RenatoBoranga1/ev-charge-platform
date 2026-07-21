import type { JwtService } from '@nestjs/jwt';

import type { AuthUser } from '../src/auth/auth-user';
import { ChargingRealtimeGateway } from '../src/charging/charging-realtime.gateway';
import type { PrismaService } from '../src/database/prisma.service';

describe('ChargingRealtimeGateway', () => {
  const user: AuthUser = {
    email: 'driver@solis.local',
    role: 'DRIVER',
    sub: 'user-1',
    tenantId: 'tenant-1',
  };
  const verifyAsync = jest.fn();
  const findFirst = jest.fn();
  const gateway = new ChargingRealtimeGateway(
    { verifyAsync } as unknown as JwtService,
    {
      chargingSession: { findFirst },
    } as unknown as PrismaService,
  );

  beforeEach(() => {
    verifyAsync.mockReset();
    findFirst.mockReset();
  });

  it('rejects a socket without an access token', async () => {
    const disconnect = jest.fn();
    await gateway.handleConnection({
      data: {},
      disconnect,
      handshake: { auth: {} },
    } as never);
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('authenticates and immediately recovers current metrics on subscribe', async () => {
    verifyAsync.mockResolvedValue(user);
    const socket = {
      data: {},
      disconnect: jest.fn(),
      emit: jest.fn(),
      handshake: { auth: { token: 'access-token' } },
      join: jest.fn().mockResolvedValue(undefined),
    };
    await gateway.handleConnection(socket as never);
    expect(socket.data).toEqual({ user });

    findFirst.mockResolvedValue({
      completedAt: null,
      currentPowerKw: 22,
      energyKwh: 3,
      id: 'session-1',
      startedAt: new Date(Date.now() - 10_000),
      status: 'CHARGING',
      stoppedAt: null,
      tariffSnapshot: {
        activationFee: 1,
        currency: 'BRL',
        initialBatteryPercent: 30,
        parkingFeeHour: 0,
        pricePerKwh: 2,
      },
      vehicle: { batteryCapacityKwh: 60 },
    });
    await gateway.subscribe(socket as never, { sessionId: 'session-1' });

    expect(socket.join).toHaveBeenCalledWith('charging-session:session-1');
    expect(socket.emit).toHaveBeenCalledWith(
      'charging:metrics',
      expect.objectContaining({
        energyKwh: 3,
        sessionId: 'session-1',
        status: 'charging',
      }),
    );
  });

  it('reports an unknown session without joining a room', async () => {
    findFirst.mockResolvedValue(null);
    const socket = {
      data: { user },
      disconnect: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
    };
    await gateway.subscribe(socket as never, { sessionId: 'missing' });
    expect(socket.emit).toHaveBeenCalledWith('charging:error', {
      message: 'Session not found.',
    });
    expect(socket.join).not.toHaveBeenCalled();
  });
});
