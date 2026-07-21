import type { Prisma } from '@solis/database';

export interface DomainEvent {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  tenantId: string;
}

export abstract class DomainEventPublisher {
  abstract publish(
    event: DomainEvent,
    transaction?: Prisma.TransactionClient,
  ): Promise<void>;
}
