import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { environment } from '../../config/environment';
import { PaymentReconciliationService } from './payment-reconciliation.service';

@Injectable()
export class PaymentReconciliationJob
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;

  constructor(private readonly reconciliation: PaymentReconciliationService) {}

  onModuleInit(): void {
    if (!environment.paymentReconciliationEnabled) return;
    this.timer = setInterval(
      () => void this.reconciliation.run(),
      environment.paymentReconciliationIntervalMs,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
