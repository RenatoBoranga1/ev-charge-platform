import type {
  ChargingConnectionState,
  ChargingRealtimeClient,
} from './ChargingRealtimeClient';
import type { ChargingSessionRealtimeEvent } from '@/types/domain';

export class MockChargingRealtimeClient implements ChargingRealtimeClient {
  private sessionId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<
    (event: ChargingSessionRealtimeEvent) => void
  >();
  private readonly connectionListeners = new Set<
    (state: ChargingConnectionState) => void
  >();
  private readonly errorListeners = new Set<(message: string) => void>();
  private elapsedSeconds = 0;
  private energyKwh = 0;

  async connect(sessionId: string): Promise<void> {
    this.disconnect();
    this.notifyConnection('connecting');
    this.sessionId = sessionId;
    this.notifyConnection('connected');
    this.timer = setInterval(() => {
      if (!this.sessionId) return;

      this.elapsedSeconds += 5;
      const powerVariation = Math.sin(this.elapsedSeconds / 20) * 5;
      const currentPowerKw = Number((72 + powerVariation).toFixed(1));
      this.energyKwh = Number(
        (this.energyKwh + (currentPowerKw * 5) / 3600).toFixed(3),
      );

      const event: ChargingSessionRealtimeEvent = {
        sessionId: this.sessionId,
        occurredAt: new Date().toISOString(),
        status: 'charging',
        elapsedSeconds: this.elapsedSeconds,
        energyKwh: this.energyKwh,
        currentPowerKw,
        estimatedCost: Number((this.energyKwh * 2.19).toFixed(2)),
        estimatedBatteryPercent: Math.min(
          100,
          Number((42 + this.energyKwh / 0.64).toFixed(1)),
        ),
      };
      this.listeners.forEach((listener) => listener(event));
    }, 1000);
  }

  disconnect(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.sessionId = null;
    this.notifyConnection('disconnected');
  }

  async reconnect(): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) throw new Error('Sessao nao selecionada para reconexao.');
    await this.connect(sessionId);
  }

  subscribe(
    listener: (event: ChargingSessionRealtimeEvent) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeConnection(
    listener: (state: ChargingConnectionState) => void,
  ): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  subscribeError(listener: (message: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private notifyConnection(state: ChargingConnectionState): void {
    this.connectionListeners.forEach((listener) => listener(state));
  }
}
