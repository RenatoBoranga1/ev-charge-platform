import { ConflictException } from '@nestjs/common';
import { PaymentIntentStatus } from '@solis/database';

const transitions: Readonly<
  Record<PaymentIntentStatus, readonly PaymentIntentStatus[]>
> = {
  [PaymentIntentStatus.CREATED]: [
    PaymentIntentStatus.PENDING,
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.FAILED,
  ],
  [PaymentIntentStatus.PENDING]: [
    PaymentIntentStatus.REQUIRES_ACTION,
    PaymentIntentStatus.AUTHORIZED,
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.EXPIRED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.REQUIRES_REVIEW,
  ],
  [PaymentIntentStatus.REQUIRES_ACTION]: [
    PaymentIntentStatus.PENDING,
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.EXPIRED,
    PaymentIntentStatus.FAILED,
  ],
  [PaymentIntentStatus.AUTHORIZED]: [
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.REQUIRES_REVIEW,
  ],
  [PaymentIntentStatus.PROCESSING]: [
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.REQUIRES_REVIEW,
  ],
  [PaymentIntentStatus.CAPTURED]: [
    PaymentIntentStatus.PARTIALLY_REFUNDED,
    PaymentIntentStatus.REFUNDED,
    PaymentIntentStatus.REQUIRES_REVIEW,
  ],
  [PaymentIntentStatus.CANCELLED]: [],
  [PaymentIntentStatus.EXPIRED]: [],
  [PaymentIntentStatus.FAILED]: [
    PaymentIntentStatus.PENDING,
    PaymentIntentStatus.REQUIRES_REVIEW,
  ],
  [PaymentIntentStatus.REQUIRES_REVIEW]: [
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.CAPTURED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.PARTIALLY_REFUNDED,
    PaymentIntentStatus.REFUNDED,
  ],
  [PaymentIntentStatus.REFUNDED]: [],
  [PaymentIntentStatus.PARTIALLY_REFUNDED]: [
    PaymentIntentStatus.REFUNDED,
    PaymentIntentStatus.REQUIRES_REVIEW,
  ],
};

export function assertPaymentIntentTransition(
  current: PaymentIntentStatus,
  target: PaymentIntentStatus,
): void {
  if (current === target) return;
  if (!transitions[current].includes(target)) {
    throw new ConflictException({
      code: 'INVALID_PAYMENT_INTENT_TRANSITION',
      message: `PaymentIntent cannot transition from ${current} to ${target}.`,
    });
  }
}

export function isTerminalPaymentIntentStatus(
  status: PaymentIntentStatus,
): boolean {
  return new Set<PaymentIntentStatus>([
    PaymentIntentStatus.CANCELLED,
    PaymentIntentStatus.EXPIRED,
    PaymentIntentStatus.REFUNDED,
  ]).has(status);
}

export function requiresPaymentReconciliation(
  status: PaymentIntentStatus,
): boolean {
  return status === PaymentIntentStatus.REQUIRES_REVIEW;
}
