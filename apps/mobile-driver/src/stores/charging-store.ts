import { create } from 'zustand';

import type {
  ChargingSession,
  ChargingSessionRealtimeEvent,
  ChargingSummary,
  ValidatedConnector,
} from '@/types/domain';

interface ChargingState {
  validatedConnector: ValidatedConnector | null;
  selectedVehicleId: string | null;
  selectedPaymentMethodId: string | null;
  activeSession: ChargingSession | null;
  summary: ChargingSummary | null;
  setValidatedConnector: (value: ValidatedConnector | null) => void;
  selectVehicle: (vehicleId: string) => void;
  selectPaymentMethod: (paymentMethodId: string) => void;
  setActiveSession: (session: ChargingSession | null) => void;
  applyRealtimeEvent: (event: ChargingSessionRealtimeEvent) => void;
  setSummary: (summary: ChargingSummary | null) => void;
  reset: () => void;
}

const initialState = {
  validatedConnector: null,
  selectedVehicleId: null,
  selectedPaymentMethodId: null,
  activeSession: null,
  summary: null,
};

export const useChargingStore = create<ChargingState>((set) => ({
  ...initialState,
  setValidatedConnector: (validatedConnector) => set({ validatedConnector }),
  selectVehicle: (selectedVehicleId) => set({ selectedVehicleId }),
  selectPaymentMethod: (selectedPaymentMethodId) =>
    set({ selectedPaymentMethodId }),
  setActiveSession: (activeSession) => set({ activeSession }),
  applyRealtimeEvent: (event) =>
    set((state) => {
      if (!state.activeSession || state.activeSession.id !== event.sessionId) {
        return state;
      }
      return {
        activeSession: {
          ...state.activeSession,
          status: event.status,
          elapsedSeconds: event.elapsedSeconds,
          energyKwh: event.energyKwh,
          currentPowerKw: event.currentPowerKw,
          estimatedCost: event.estimatedCost,
          ...(event.estimatedBatteryPercent !== undefined
            ? {
                estimatedBatteryPercent: event.estimatedBatteryPercent,
              }
            : {}),
        },
      };
    }),
  setSummary: (summary) => set({ summary }),
  reset: () => set(initialState),
}));
