import { Module } from '@nestjs/common';

import { MockPaymentGateway } from './mock-payment.gateway';
import { PaymentGateway } from './payment.gateway';

@Module({
  exports: [PaymentGateway],
  providers: [
    MockPaymentGateway,
    { provide: PaymentGateway, useExisting: MockPaymentGateway },
  ],
})
export class PaymentProviderModule {}
