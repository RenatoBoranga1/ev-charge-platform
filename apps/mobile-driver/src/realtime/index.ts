import type { ChargingRealtimeClient } from './ChargingRealtimeClient';
import { MockChargingRealtimeClient } from './MockChargingRealtimeClient';
import { WebSocketChargingRealtimeClient } from './WebSocketChargingRealtimeClient';

function createRealtimeClient(): ChargingRealtimeClient {
  const mode = process.env.EXPO_PUBLIC_API_MODE ?? 'mock';
  if (mode === 'mock') return new MockChargingRealtimeClient();

  const wsUrl = process.env.EXPO_PUBLIC_WS_URL;
  if (!wsUrl) {
    throw new Error('EXPO_PUBLIC_WS_URL é obrigatória no modo api.');
  }
  return new WebSocketChargingRealtimeClient(wsUrl);
}

export const chargingRealtimeClient = createRealtimeClient();
