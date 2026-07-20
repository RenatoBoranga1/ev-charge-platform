export interface DomainEvent {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  tenantId: string;
}

export abstract class DomainEventPublisher {
  abstract publish(event: DomainEvent): Promise<void>;
}
