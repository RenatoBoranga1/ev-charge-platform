import type { ChargingSessionRealtimeEvent } from '@/types/domain';

export type ChargingConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface ChargingRealtimeClient {
  connect(sessionId: string): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  subscribe(
    listener: (event: ChargingSessionRealtimeEvent) => void,
  ): () => void;
  subscribeConnection(
    listener: (state: ChargingConnectionState) => void,
  ): () => void;
  subscribeError(listener: (message: string) => void): () => void;
}
