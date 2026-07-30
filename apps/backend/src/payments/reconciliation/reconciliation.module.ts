import { Module } from '@nestjs/common';

import { PaymentProviderModule } from '../gateway/payment-provider.module';
import { PaymentReconciliationJob } from './payment-reconciliation.job';
import { PaymentReconciliationService } from './payment-reconciliation.service';

@Module({
  exports: [PaymentReconciliationService],
  imports: [PaymentProviderModule],
  providers: [PaymentReconciliationJob, PaymentReconciliationService],
})
export class ReconciliationModule {}
