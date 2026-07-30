import { Module } from '@nestjs/common';

import { OutboxModule } from '../../outbox/outbox.module';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

@Module({
  exports: [LedgerService],
  imports: [OutboxModule],
  providers: [LedgerRepository, LedgerService],
})
export class LedgerModule {}
