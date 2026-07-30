import { PaymentIntentStatus } from '@solis/database';

import {
  assertPaymentIntentTransition,
  isTerminalPaymentIntentStatus,
  requiresPaymentReconciliation,
} from '../src/payments/intents/payment-intent-state-machine';

describe('PaymentIntent state machine', () => {
  it.each([
    [PaymentIntentStatus.CREATED, PaymentIntentStatus.PENDING],
    [PaymentIntentStatus.PENDING, PaymentIntentStatus.REQUIRES_ACTION],
    [PaymentIntentStatus.PENDING, PaymentIntentStatus.CAPTURED],
    [PaymentIntentStatus.AUTHORIZED, PaymentIntentStatus.PROCESSING],
    [PaymentIntentStatus.PROCESSING, PaymentIntentStatus.CAPTURED],
    [PaymentIntentStatus.CAPTURED, PaymentIntentStatus.PARTIALLY_REFUNDED],
    [PaymentIntentStatus.PARTIALLY_REFUNDED, PaymentIntentStatus.REFUNDED],
    [PaymentIntentStatus.FAILED, PaymentIntentStatus.PENDING],
    [PaymentIntentStatus.REQUIRES_REVIEW, PaymentIntentStatus.FAILED],
  ])('accepts %s -> %s', (current, target) => {
    expect(() => assertPaymentIntentTransition(current, target)).not.toThrow();
  });

  it('treats a repeated state as an idempotent transition', () => {
    expect(() =>
      assertPaymentIntentTransition(
        PaymentIntentStatus.CAPTURED,
        PaymentIntentStatus.CAPTURED,
      ),
    ).not.toThrow();
  });

  it.each([
    [PaymentIntentStatus.CREATED, PaymentIntentStatus.CAPTURED],
    [PaymentIntentStatus.CANCELLED, PaymentIntentStatus.PENDING],
    [PaymentIntentStatus.EXPIRED, PaymentIntentStatus.CAPTURED],
    [PaymentIntentStatus.REFUNDED, PaymentIntentStatus.PROCESSING],
    [PaymentIntentStatus.CAPTURED, PaymentIntentStatus.PENDING],
  ])('rejects %s -> %s', (current, target) => {
    expect(() => assertPaymentIntentTransition(current, target)).toThrow(
      'PaymentIntent cannot transition',
    );
  });

  it('classifies terminal and reconciliation states', () => {
    expect(isTerminalPaymentIntentStatus(PaymentIntentStatus.CANCELLED)).toBe(true);
    expect(isTerminalPaymentIntentStatus(PaymentIntentStatus.EXPIRED)).toBe(true);
    expect(isTerminalPaymentIntentStatus(PaymentIntentStatus.REFUNDED)).toBe(true);
    expect(isTerminalPaymentIntentStatus(PaymentIntentStatus.CAPTURED)).toBe(false);
    expect(
      requiresPaymentReconciliation(PaymentIntentStatus.REQUIRES_REVIEW),
    ).toBe(true);
    expect(requiresPaymentReconciliation(PaymentIntentStatus.PENDING)).toBe(false);
  });
});
