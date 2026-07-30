import type { Money } from '../money';

export type MockPaymentScenario =
  | 'approved'
  | 'pending'
  | 'declined'
  | 'timeout'
  | 'expired'
  | 'delayed-confirmation'
  | 'duplicate-webhook'
  | 'out-of-order-webhook'
  | 'capture-failure'
  | 'refund-failure'
  | 'unknown-status';

export type GatewayPaymentStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REQUIRES_REVIEW'
  | 'REFUNDED';

export interface PixChargeResult {
  copyPasteCode: string;
  expiresAt: Date;
  providerReference: string;
  qrPayload: string;
  status: GatewayPaymentStatus;
}

export interface GatewayPaymentResult {
  amountMinor?: string;
  currency?: string;
  providerReference: string;
  status: GatewayPaymentStatus;
}

export interface PaymentWebhook {
  amountMinor: string;
  currency: string;
  eventType: string;
  providerEventId: string;
  providerReference: string;
  status: GatewayPaymentStatus;
}

export abstract class PaymentGateway {
  abstract readonly provider: string;

  abstract createPixCharge(input: {
    idempotencyKey: string;
    money: Money;
    scenario?: MockPaymentScenario;
  }): Promise<PixChargeResult>;

  abstract getPixCharge(providerReference: string): Promise<GatewayPaymentResult>;
  abstract cancelPixCharge(providerReference: string): Promise<GatewayPaymentResult>;

  abstract createCardAuthorization(input: {
    idempotencyKey: string;
    money: Money;
    paymentMethodToken: string;
    scenario?: MockPaymentScenario;
  }): Promise<GatewayPaymentResult>;

  abstract captureCardAuthorization(input: {
    idempotencyKey: string;
    money: Money;
    providerReference: string;
    scenario?: MockPaymentScenario;
  }): Promise<GatewayPaymentResult>;

  abstract cancelCardAuthorization(
    providerReference: string,
  ): Promise<GatewayPaymentResult>;

  abstract createRefund(input: {
    idempotencyKey: string;
    money: Money;
    providerReference: string;
    scenario?: MockPaymentScenario;
  }): Promise<GatewayPaymentResult>;

  abstract getPaymentStatus(
    providerReference: string,
  ): Promise<GatewayPaymentResult>;

  abstract validateWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    timestamp: string | undefined;
  }): boolean;

  abstract parseWebhook(body: unknown): PaymentWebhook;
}
