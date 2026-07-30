import {
  BadRequestException,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import { environment } from '../../config/environment';
import { financialRequestHash } from '../financial-request-hash';
import type { Money } from '../money';
import {
  type GatewayPaymentResult,
  type GatewayPaymentStatus,
  type MockPaymentScenario,
  PaymentGateway,
  type PaymentWebhook,
  type PixChargeResult,
} from './payment.gateway';

interface StoredPayment {
  amountMinor: string;
  currency: string;
  requestHash: string;
  status: GatewayPaymentStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const selected = value[key];
  if (typeof selected !== 'string' || selected.length === 0 || selected.length > 300) {
    throw new BadRequestException(`Invalid payment webhook field: ${key}.`);
  }
  return selected;
}

@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  readonly provider = 'solis-mock';
  private readonly payments = new Map<string, StoredPayment>();

  async createPixCharge(input: {
    idempotencyKey: string;
    money: Money;
    scenario?: MockPaymentScenario;
  }): Promise<PixChargeResult> {
    await Promise.resolve();
    this.maybeTimeout(input.scenario);
    const providerReference = this.reference('pix', input.idempotencyKey);
    const status = this.scenarioStatus(input.scenario, 'PENDING');
    this.store(providerReference, input.idempotencyKey, input.money, status);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    return Promise.resolve({
      copyPasteCode: `SOLIS.PIX.${providerReference}.${input.money.amountMinor}`,
      expiresAt,
      providerReference,
      qrPayload: `000201SOLIS${providerReference}${input.money.amountMinor}`,
      status,
    });
  }

  async getPixCharge(providerReference: string): Promise<GatewayPaymentResult> {
    return this.getPaymentStatus(providerReference);
  }

  async cancelPixCharge(providerReference: string): Promise<GatewayPaymentResult> {
    await Promise.resolve();
    return Promise.resolve(this.cancel(providerReference));
  }

  async createCardAuthorization(input: {
    idempotencyKey: string;
    money: Money;
    paymentMethodToken: string;
    scenario?: MockPaymentScenario;
  }): Promise<GatewayPaymentResult> {
    await Promise.resolve();
    this.maybeTimeout(input.scenario);
    if (!input.paymentMethodToken.startsWith('mock_')) {
      throw new BadRequestException('Only tokenized mock methods are accepted.');
    }
    const providerReference = this.reference('card', input.idempotencyKey);
    const status = this.scenarioStatus(input.scenario, 'APPROVED');
    this.store(providerReference, input.idempotencyKey, input.money, status);
    return Promise.resolve({ providerReference, status });
  }

  async captureCardAuthorization(input: {
    idempotencyKey: string;
    money: Money;
    providerReference: string;
    scenario?: MockPaymentScenario;
  }): Promise<GatewayPaymentResult> {
    await Promise.resolve();
    this.maybeTimeout(input.scenario);
    const existing = this.requirePayment(input.providerReference);
    const status =
      input.scenario === 'capture-failure'
        ? 'DECLINED'
        : this.scenarioStatus(input.scenario, 'APPROVED');
    existing.status = status;
    return Promise.resolve({ providerReference: input.providerReference, status });
  }

  async cancelCardAuthorization(
    providerReference: string,
  ): Promise<GatewayPaymentResult> {
    await Promise.resolve();
    return Promise.resolve(this.cancel(providerReference));
  }

  async createRefund(input: {
    idempotencyKey: string;
    money: Money;
    providerReference: string;
    scenario?: MockPaymentScenario;
  }): Promise<GatewayPaymentResult> {
    await Promise.resolve();
    this.maybeTimeout(input.scenario);
    const existing = this.requirePayment(input.providerReference);
    existing.status =
      input.scenario === 'refund-failure' ? 'DECLINED' : 'REFUNDED';
    return Promise.resolve({
      providerReference: input.providerReference,
      status: existing.status,
    });
  }

  async getPaymentStatus(
    providerReference: string,
  ): Promise<GatewayPaymentResult> {
    await Promise.resolve();
    const payment = this.requirePayment(providerReference);
    return Promise.resolve({
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      providerReference,
      status: payment.status,
    });
  }

  validateWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    timestamp: string | undefined;
  }): boolean {
    if (!input.signature || !input.timestamp || !/^\d{10,13}$/.test(input.timestamp)) {
      return false;
    }
    const epoch = Number(input.timestamp);
    const epochMilliseconds = input.timestamp.length === 10 ? epoch * 1000 : epoch;
    if (
      !Number.isFinite(epochMilliseconds) ||
      Math.abs(Date.now() - epochMilliseconds) >
        environment.paymentWebhookToleranceSeconds * 1000
    ) {
      return false;
    }
    const expected = createHmac('sha256', environment.paymentWebhookSecret)
      .update(`${input.timestamp}.${input.rawBody}`)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(input.signature, 'hex');
    } catch {
      return false;
    }
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  parseWebhook(body: unknown): PaymentWebhook {
    if (!isRecord(body)) throw new BadRequestException('Invalid payment webhook.');
    const status = requiredString(body, 'status');
    if (
      !new Set<GatewayPaymentStatus>([
        'APPROVED',
        'PENDING',
        'DECLINED',
        'EXPIRED',
        'CANCELLED',
        'REQUIRES_REVIEW',
        'REFUNDED',
      ]).has(status as GatewayPaymentStatus)
    ) {
      throw new BadRequestException('Invalid payment webhook status.');
    }
    const amountMinor = requiredString(body, 'amountMinor');
    if (!/^\d+$/.test(amountMinor)) {
      throw new BadRequestException('Invalid payment webhook amount.');
    }
    return {
      amountMinor,
      currency: requiredString(body, 'currency'),
      eventType: requiredString(body, 'eventType'),
      providerEventId: requiredString(body, 'providerEventId'),
      providerReference: requiredString(body, 'providerReference'),
      status: status as GatewayPaymentStatus,
    };
  }

  private reference(kind: string, idempotencyKey: string): string {
    return `mock_${kind}_${financialRequestHash(idempotencyKey).slice(0, 24)}`;
  }

  private store(
    providerReference: string,
    idempotencyKey: string,
    money: Money,
    status: GatewayPaymentStatus,
  ): void {
    const requestHash = financialRequestHash({
      amountMinor: money.amountMinor,
      currency: money.currency,
      idempotencyKey,
    });
    const existing = this.payments.get(providerReference);
    if (existing && existing.requestHash !== requestHash) {
      throw new BadRequestException('Mock provider idempotency conflict.');
    }
    this.payments.set(providerReference, {
      amountMinor: money.amountMinor.toString(),
      currency: money.currency,
      requestHash,
      status,
    });
  }

  private cancel(providerReference: string): GatewayPaymentResult {
    const existing = this.requirePayment(providerReference);
    existing.status = 'CANCELLED';
    return { providerReference, status: existing.status };
  }

  private requirePayment(providerReference: string): StoredPayment {
    const payment = this.payments.get(providerReference);
    if (!payment) throw new NotFoundException('Mock provider payment not found.');
    return payment;
  }

  private maybeTimeout(scenario?: MockPaymentScenario): void {
    if (scenario === 'timeout') throw new RequestTimeoutException('Mock timeout.');
  }

  private scenarioStatus(
    scenario: MockPaymentScenario | undefined,
    approvedDefault: GatewayPaymentStatus,
  ): GatewayPaymentStatus {
    if (!scenario || scenario === 'approved' || scenario === 'duplicate-webhook') {
      return approvedDefault;
    }
    if (
      scenario === 'pending' ||
      scenario === 'delayed-confirmation' ||
      scenario === 'out-of-order-webhook'
    ) {
      return 'PENDING';
    }
    if (scenario === 'declined' || scenario === 'capture-failure' || scenario === 'refund-failure') {
      return 'DECLINED';
    }
    if (scenario === 'expired') return 'EXPIRED';
    if (scenario === 'unknown-status') return 'REQUIRES_REVIEW';
    return approvedDefault;
  }
}
