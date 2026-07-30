import { createHmac } from 'node:crypto';

import { environment } from '../src/config/environment';
import { MockPaymentGateway } from '../src/payments/gateway/mock-payment.gateway';
import { Money } from '../src/payments/money';

describe('MockPaymentGateway', () => {
  const gateway = new MockPaymentGateway();
  const money = Money.fromMinorUnits(10_000n);

  it('creates deterministic, idempotent Pix charges', async () => {
    const first = await gateway.createPixCharge({
      idempotencyKey: 'pix-one',
      money,
    });
    const repeated = await gateway.createPixCharge({
      idempotencyKey: 'pix-one',
      money,
    });
    expect(repeated).toMatchObject({
      providerReference: first.providerReference,
      status: 'PENDING',
    });
    expect(first.copyPasteCode).toContain(first.providerReference);
    expect(await gateway.getPixCharge(first.providerReference)).toMatchObject({
      status: 'PENDING',
    });
  });

  it.each([
    ['pending', 'PENDING'],
    ['declined', 'DECLINED'],
    ['expired', 'EXPIRED'],
    ['unknown-status', 'REQUIRES_REVIEW'],
  ] as const)('maps %s to %s', async (scenario, status) => {
    const result = await gateway.createPixCharge({
      idempotencyKey: `scenario-${scenario}`,
      money,
      scenario,
    });
    expect(result.status).toBe(status);
  });

  it('simulates timeout deterministically', async () => {
    await expect(
      gateway.createPixCharge({
        idempotencyKey: 'timeout',
        money,
        scenario: 'timeout',
      }),
    ).rejects.toThrow('Mock timeout');
  });

  it('authorizes, captures and cancels tokenized cards', async () => {
    const authorization = await gateway.createCardAuthorization({
      idempotencyKey: 'card-one',
      money,
      paymentMethodToken: 'mock_token',
    });
    expect(authorization.status).toBe('APPROVED');
    expect(
      await gateway.captureCardAuthorization({
        idempotencyKey: 'capture-one',
        money,
        providerReference: authorization.providerReference,
      }),
    ).toMatchObject({ status: 'APPROVED' });
    expect(
      await gateway.cancelCardAuthorization(authorization.providerReference),
    ).toMatchObject({ status: 'CANCELLED' });
  });

  it('simulates capture and refund failures', async () => {
    const authorization = await gateway.createCardAuthorization({
      idempotencyKey: 'card-failure',
      money,
      paymentMethodToken: 'mock_token',
    });
    expect(
      await gateway.captureCardAuthorization({
        idempotencyKey: 'capture-failure',
        money,
        providerReference: authorization.providerReference,
        scenario: 'capture-failure',
      }),
    ).toMatchObject({ status: 'DECLINED' });
    expect(
      await gateway.createRefund({
        idempotencyKey: 'refund-failure',
        money,
        providerReference: authorization.providerReference,
        scenario: 'refund-failure',
      }),
    ).toMatchObject({ status: 'DECLINED' });
  });

  it('rejects non-tokenized cards and unknown references', async () => {
    await expect(
      gateway.createCardAuthorization({
        idempotencyKey: 'unsafe-card',
        money,
        paymentMethodToken: '4111111111111111',
      }),
    ).rejects.toThrow('tokenized mock');
    await expect(gateway.getPaymentStatus('missing')).rejects.toThrow(
      'not found',
    );
  });

  it('validates timestamped HMAC signatures without exposing the secret', () => {
    const rawBody = '{"providerEventId":"event"}';
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', environment.paymentWebhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    expect(gateway.validateWebhook({ rawBody, signature, timestamp })).toBe(true);
    expect(
      gateway.validateWebhook({ rawBody, signature: '00', timestamp }),
    ).toBe(false);
    expect(
      gateway.validateWebhook({
        rawBody,
        signature,
        timestamp: String(Date.now() - 999_999_999),
      }),
    ).toBe(false);
  });

  it('parses and validates webhook payloads', () => {
    expect(
      gateway.parseWebhook({
        amountMinor: '10000',
        currency: 'BRL',
        eventType: 'PIX_CONFIRMED',
        providerEventId: 'evt-1',
        providerReference: 'mock-pix',
        status: 'APPROVED',
      }),
    ).toMatchObject({ status: 'APPROVED' });
    expect(() => gateway.parseWebhook(null)).toThrow('Invalid payment webhook');
    expect(() =>
      gateway.parseWebhook({
        amountMinor: '10.00',
        currency: 'BRL',
        eventType: 'PIX',
        providerEventId: 'event',
        providerReference: 'ref',
        status: 'APPROVED',
      }),
    ).toThrow('amount');
  });
});
