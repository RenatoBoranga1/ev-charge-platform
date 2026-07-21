import { Injectable } from '@nestjs/common';
import { Prisma } from '@solis/database';

import { PrismaService } from '../database/prisma.service';
import {
  type DomainEvent,
  DomainEventPublisher,
} from './domain-event-publisher';

@Injectable()
export class OutboxEventPublisher extends DomainEventPublisher {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async publish(
    event: DomainEvent,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;
    await client.outboxEvent.create({
      data: {
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        tenantId: event.tenantId,
      },
    });
  }
}
