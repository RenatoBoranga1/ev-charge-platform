import type { ChargingRealtimeClient } from './ChargingRealtimeClient';
import type { ChargingSessionRealtimeEvent } from '@/types/domain';

export class WebSocketChargingRealtimeClient implements ChargingRealtimeClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<
    (event: ChargingSessionRealtimeEvent) => void
  >();

  constructor(private readonly baseUrl: string) {}

  async connect(sessionId: string): Promise<void> {
    this.disconnect();
    this.socket = new WebSocket(
      `${this.baseUrl.replace(/\/$/, '')}/charging-sessions/${sessionId}`,
    );
    this.socket.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as ChargingSessionRealtimeEvent;
      this.listeners.forEach((listener) => listener(event));
    };
    await new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('WebSocket não inicializado.'));
        return;
      }
      this.socket.onopen = () => resolve();
      this.socket.onerror = () =>
        reject(new Error('Não foi possível conectar às atualizações em tempo real.'));
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  subscribe(
    listener: (event: ChargingSessionRealtimeEvent) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
