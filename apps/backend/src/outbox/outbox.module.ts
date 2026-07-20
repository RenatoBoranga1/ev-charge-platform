import { Module } from '@nestjs/common';

import { DomainEventPublisher } from './domain-event-publisher';
import { OutboxEventPublisher } from './outbox-event.publisher';

@Module({
  providers: [
    OutboxEventPublisher,
    { provide: DomainEventPublisher, useExisting: OutboxEventPublisher },
  ],
  exports: [DomainEventPublisher],
})
export class OutboxModule {}
