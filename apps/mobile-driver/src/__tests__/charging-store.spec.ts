import { useChargingStore } from '@/stores/charging-store';

describe('charging store', () => {
  beforeEach(() => useChargingStore.getState().reset());

  it('stores vehicle and payment selections', () => {
    useChargingStore.getState().selectVehicle('vehicle-1');
    useChargingStore.getState().selectPaymentMethod('payment-1');

    expect(useChargingStore.getState().selectedVehicleId).toBe('vehicle-1');
    expect(useChargingStore.getState().selectedPaymentMethodId).toBe('payment-1');
  });
});
