import type { ChargingRealtimeClient } from './ChargingRealtimeClient';
import type { ChargingSessionRealtimeEvent } from '@/types/domain';

export class MockChargingRealtimeClient implements ChargingRealtimeClient {
  private sessionId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<
    (event: ChargingSessionRealtimeEvent) => void
  >();
  private elapsedSeconds = 0;
  private energyKwh = 0;

  async connect(sessionId: string): Promise<void> {
    this.disconnect();
    this.sessionId = sessionId;
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
  }

  subscribe(
    listener: (event: ChargingSessionRealtimeEvent) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
