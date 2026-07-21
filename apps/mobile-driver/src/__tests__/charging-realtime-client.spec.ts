import { io } from 'socket.io-client';

import { tokenStorage } from '@/auth/token-storage';
import { WebSocketChargingRealtimeClient } from '@/realtime/WebSocketChargingRealtimeClient';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('@/auth/token-storage', () => ({
  tokenStorage: { getAccessToken: jest.fn() },
}));

describe('WebSocketChargingRealtimeClient', () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const onceHandlers = new Map<string, (...args: unknown[]) => void>();
  const managerHandlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    active: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    io: {
      on: jest.fn(
        (event: string, handler: (...args: unknown[]) => void) =>
          managerHandlers.set(event, handler),
      ),
    },
    off: jest.fn(),
    on: jest.fn(
      (event: string, handler: (...args: unknown[]) => void) =>
        handlers.set(event, handler),
    ),
    once: jest.fn(
      (event: string, handler: (...args: unknown[]) => void) =>
        onceHandlers.set(event, handler),
    ),
  };

  beforeEach(() => {
    handlers.clear();
    onceHandlers.clear();
    managerHandlers.clear();
    jest.clearAllMocks();
    jest.mocked(io).mockReturnValue(socket as never);
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue('access-token');
    socket.connect.mockImplementation(() => {
      handlers.get('connect')?.();
      onceHandlers.get('connect')?.();
      return socket;
    });
  });

  it('authenticates, subscribes and publishes recovered metrics', async () => {
    const client = new WebSocketChargingRealtimeClient('ws://api.solis.local/');
    const metrics = jest.fn();
    const states = jest.fn();
    client.subscribe(metrics);
    client.subscribeConnection(states);

    await client.connect('session-1');

    expect(io).toHaveBeenCalledWith(
      'http://api.solis.local/charging',
      expect.objectContaining({
        auth: { token: 'access-token' },
        reconnection: true,
        transports: ['websocket'],
      }),
    );
    expect(socket.emit).toHaveBeenCalledWith('charging:subscribe', {
      sessionId: 'session-1',
    });
    expect(states).toHaveBeenCalledWith('connecting');
    expect(states).toHaveBeenCalledWith('connected');

    const event = {
      currentPowerKw: 30,
      elapsedSeconds: 15,
      energyKwh: 1,
      estimatedCost: 2,
      occurredAt: new Date().toISOString(),
      sessionId: 'session-1',
      status: 'charging' as const,
    };
    handlers.get('charging:metrics')?.(event);
    expect(metrics).toHaveBeenCalledWith(event);
  });

  it('rejects connection without a stored token', async () => {
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue(null);
    const client = new WebSocketChargingRealtimeClient('https://api.solis.local');
    await expect(client.connect('session-1')).rejects.toThrow('Sessao expirada');
    expect(io).not.toHaveBeenCalled();
  });

  it('reports reconnecting and supports explicit retry', async () => {
    const client = new WebSocketChargingRealtimeClient('https://api.solis.local');
    const states = jest.fn();
    client.subscribeConnection(states);
    await client.connect('session-1');

    managerHandlers.get('reconnect_attempt')?.();
    expect(states).toHaveBeenCalledWith('reconnecting');
    await client.reconnect();
    expect(socket.connect).toHaveBeenCalledTimes(2);
  });

  it('reports server errors without throwing from the socket callback', async () => {
    const client = new WebSocketChargingRealtimeClient('https://api.solis.local');
    const errors = jest.fn();
    client.subscribeError(errors);
    await client.connect('session-1');

    expect(() =>
      handlers.get('charging:error')?.({ message: 'Session not found.' }),
    ).not.toThrow();
    expect(errors).toHaveBeenCalledWith('Session not found.');
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
