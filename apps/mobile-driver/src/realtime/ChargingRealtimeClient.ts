import type { ChargingSessionRealtimeEvent } from '@/types/domain';

export interface ChargingRealtimeClient {
  connect(sessionId: string): Promise<void>;
  disconnect(): void;
  subscribe(
    listener: (event: ChargingSessionRealtimeEvent) => void,
  ): () => void;
}
