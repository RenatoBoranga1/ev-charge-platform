import { Module } from '@nestjs/common';

import { OutboxModule } from '../../outbox/outbox.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletController } from './wallet.controller';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';

@Module({
  controllers: [WalletController],
  exports: [WalletService],
  imports: [LedgerModule, OutboxModule],
  providers: [WalletRepository, WalletService],
})
export class WalletModule {}
