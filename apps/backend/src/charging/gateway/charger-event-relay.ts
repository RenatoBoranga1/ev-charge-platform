import { Injectable } from '@nestjs/common';

export type ChargerEventType =
  | 'METER_VALUE'
  | 'STOPPED'
  | 'FAILED'
  | 'DISCONNECTED';

export interface ChargerEvent {
  batteryPercent?: number;
  meterWh?: string;
  occurredAt: string;
  powerKw?: number;
  reason?: string;
  recoverable?: boolean;
  sessionId: string;
  type: ChargerEventType;
}

export type ChargerEventListener = (
  event: ChargerEvent,
  correlationId: string,
) => Promise<void>;

@Injectable()
export class ChargerEventRelay {
  private readonly listeners = new Set<ChargerEventListener>();

  subscribe(listener: ChargerEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(event: ChargerEvent, correlationId: string): Promise<void> {
    for (const listener of this.listeners) {
      await listener(event, correlationId);
    }
  }
}