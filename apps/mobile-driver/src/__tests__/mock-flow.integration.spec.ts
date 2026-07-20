import { createMockApiClients } from '@/api/mock-api';
import { MockChargingRealtimeClient } from '@/realtime/MockChargingRealtimeClient';

describe('mock charging flow', () => {
  it('validates, preauthorizes, streams, stops and calculates the final amount', async () => {
    const api = createMockApiClients();
    const validated = await api.charging.validateManualCode('SOLIS-001-A');
    expect(validated.connector.status).toBe('AVAILABLE');

    const vehicles = await api.vehicles.list();
    const payments = await api.payments.list();
    const session = await api.charging.start({
      validatedConnector: validated,
      vehicleId: vehicles[0]!.id,
      paymentMethodId: payments[0]!.id,
      idempotencyKey: 'integration-flow-001',
    });
    expect(session.status).toBe('charging');

    const realtime = new MockChargingRealtimeClient();
    const firstEvent = new Promise<number>((resolve) => {
      const unsubscribe = realtime.subscribe((event) => {
        unsubscribe();
        resolve(event.energyKwh);
      });
    });
    await realtime.connect(session.id);
    await expect(firstEvent).resolves.toBeGreaterThan(0);
    realtime.disconnect();

    const summary = await api.charging.stop(session.id);
    expect(summary.session.status).toBe('completed');
    expect(summary.price.totalAmount).toBeGreaterThanOrEqual(0);
  }, 10_000);
});
