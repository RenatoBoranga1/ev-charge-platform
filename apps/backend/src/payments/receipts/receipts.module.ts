import { Module } from '@nestjs/common';

import { OutboxModule } from '../../outbox/outbox.module';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';

@Module({
  controllers: [ReceiptController],
  exports: [ReceiptService],
  imports: [OutboxModule],
  providers: [ReceiptService],
})
export class ReceiptsModule {}
