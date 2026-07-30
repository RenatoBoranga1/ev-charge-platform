import { Module } from '@nestjs/common';

import { OutboxModule } from '../../outbox/outbox.module';
import { WalletModule } from '../wallet/wallet.module';
import { RefundService } from './refund.service';

@Module({
  exports: [RefundService],
  imports: [OutboxModule, WalletModule],
  providers: [RefundService],
})
export class RefundsModule {}
