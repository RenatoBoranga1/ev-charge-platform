/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ChargerSimulator } from '../src/simulator';

describe('ChargerSimulator', () => {
  const callback = jest.fn();
  let simulator: ChargerSimulator;

  beforeEach(() => {
    jest.useFakeTimers();
    callback.mockReset();
    callback.mockResolvedValue({ ok: true });
    global.fetch = callback;
    simulator = new ChargerSimulator({
      callbackSecret: 'secret',
      meterIntervalMs: 1000,
    });
    simulator.registerConnector({
      connectorId: 'connector-1',
      maximumPowerKw: 50,
      status: 'AVAILABLE',
    });
  });

  afterEach(() => {
    simulator.shutdown();
    jest.useRealTimers();
  });

  it('registers a connector and makes start idempotent', () => {
    const command = {
      callbackUrl: 'http://backend/internal/charger-events',
      connectorId: 'connector-1',
      maximumPowerKw: 74,
      sessionId: 'session-1',
    };
    const first = simulator.start(command);
    const second = simulator.start(command);
    expect(second).toEqual(first);
    expect(first.powerKw).toBe(50);
    expect(simulator.listConnectors()[0]?.status).toBe('OCCUPIED');
    expect(() =>
      simulator.setConnectorStatus('connector-1', 'AVAILABLE'),
    ).toThrow('active session');
  });

  it('blocks start while a connector is offline or occupied', () => {
    simulator.setConnectorStatus('connector-1', 'OFFLINE');
    expect(() =>
      simulator.start({
        callbackUrl: 'http://backend/events',
        connectorId: 'connector-1',
        maximumPowerKw: 22,
        sessionId: 'offline',
      }),
    ).toThrow('offline or occupied');

    simulator.setConnectorStatus('connector-1', 'AVAILABLE');
    simulator.start({
      callbackUrl: 'http://backend/events',
      connectorId: 'connector-1',
      maximumPowerKw: 22,
      sessionId: 'first',
    });
    expect(() =>
      simulator.start({
        callbackUrl: 'http://backend/events',
        connectorId: 'connector-1',
        maximumPowerKw: 22,
        sessionId: 'second',
      }),
    ).toThrow('offline or occupied');
  });

  it('emits meter values and makes stop idempotent', async () => {
    simulator.start({
      callbackUrl: 'http://backend/events',
      connectorId: 'connector-1',
      maximumPowerKw: 36,
      sessionId: 'session-1',
    });
    await jest.advanceTimersByTimeAsync(2000);
    expect(callback).toHaveBeenCalledWith(
      'http://backend/events',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-simulator-secret': 'secret',
        }),
      }),
    );
    const first = simulator.stop('session-1');
    const second = simulator.stop('session-1');
    expect(second).toEqual(first);
    expect(simulator.listConnectors()[0]?.status).toBe('AVAILABLE');
  });

  it('runs failure and disconnection scenarios', async () => {
    simulator.start({
      callbackUrl: 'http://backend/events',
      connectorId: 'connector-1',
      maximumPowerKw: 22,
      scenario: 'fail-after-3',
      sessionId: 'failed',
    });
    await jest.advanceTimersByTimeAsync(3000);
    expect(simulator.listConnectors()[0]?.status).toBe('FAULTED');
    expect(callback).toHaveBeenCalledWith(
      'http://backend/events',
      expect.objectContaining({
        body: expect.stringContaining('"type":"FAILED"'),
      }),
    );

    simulator.setConnectorStatus('connector-1', 'AVAILABLE');
    simulator.start({
      callbackUrl: 'http://backend/events',
      connectorId: 'connector-1',
      maximumPowerKw: 22,
      scenario: 'disconnect-after-3',
      sessionId: 'disconnected',
    });
    await jest.advanceTimersByTimeAsync(3000);
    expect(simulator.listConnectors()[0]?.status).toBe('OFFLINE');
    expect(callback).toHaveBeenCalledWith(
      'http://backend/events',
      expect.objectContaining({
        body: expect.stringContaining('"type":"DISCONNECTED"'),
      }),
    );
  });

  it('validates registrations and callback responses', async () => {
    expect(() =>
      simulator.registerConnector({
        connectorId: '',
        maximumPowerKw: 0,
        status: 'AVAILABLE',
      }),
    ).toThrow('Invalid connector registration');
    callback.mockResolvedValueOnce({ ok: false, status: 503 });
    simulator.start({
      callbackUrl: 'http://backend/events',
      connectorId: 'connector-1',
      maximumPowerKw: 22,
      sessionId: 'callback-failure',
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(simulator.listConnectors()[0]?.status).toBe('FAULTED');
  });
});
