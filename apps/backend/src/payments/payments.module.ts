import { Module } from '@nestjs/common';

import { OutboxModule } from '../outbox/outbox.module';
import { AutoRechargeController } from './auto-recharge/auto-recharge.controller';
import { AutoRechargeService } from './auto-recharge/auto-recharge.service';
import { ChargingPaymentPolicy } from './charging/charging-payment.policy';
import { PaymentProviderModule } from './gateway/payment-provider.module';
import { PaymentIntentController } from './intents/payment-intent.controller';
import { PaymentIntentService } from './intents/payment-intent.service';
import { LedgerModule } from './ledger/ledger.module';
import { PaymentMethodController } from './methods/payment-method.controller';
import { PaymentMethodService } from './methods/payment-method.service';
import { ReceiptsModule } from './receipts/receipts.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { RefundsModule } from './refunds/refunds.module';
import { TopUpController } from './topups/top-up.controller';
import { TopUpService } from './topups/top-up.service';
import { WalletModule } from './wallet/wallet.module';
import { PaymentWebhookController } from './webhooks/payment-webhook.controller';
import { PaymentWebhookService } from './webhooks/payment-webhook.service';

@Module({
  controllers: [
    AutoRechargeController,
    PaymentIntentController,
    PaymentMethodController,
    PaymentWebhookController,
    TopUpController,
  ],
  exports: [
    LedgerModule,
    ChargingPaymentPolicy,
    PaymentIntentService,
    PaymentProviderModule,
    ReconciliationModule,
    RefundsModule,
    TopUpService,
    WalletModule,
  ],
  imports: [
    LedgerModule,
    OutboxModule,
    PaymentProviderModule,
    ReceiptsModule,
    ReconciliationModule,
    RefundsModule,
    WalletModule,
  ],
  providers: [
    AutoRechargeService,
    ChargingPaymentPolicy,
    PaymentIntentService,
    PaymentMethodService,
    PaymentWebhookService,
    TopUpService,
  ],
})
export class PaymentsModule {}
