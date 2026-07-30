import { createHmac, randomUUID } from 'node:crypto';
import {
  PaymentIntentStatus,
  LedgerTransactionType,
  PaymentMethodType,
  PaymentWebhookProcessingStatus,
  UserRole,
} from '@solis/database';

import type { AuthUser } from '../src/auth/auth-user';
import { environment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxEventPublisher } from '../src/outbox/outbox-event.publisher';
import { MockPaymentGateway } from '../src/payments/gateway/mock-payment.gateway';
import { LedgerRepository } from '../src/payments/ledger/ledger.repository';
import { LedgerService } from '../src/payments/ledger/ledger.service';
import { PaymentIntentService } from '../src/payments/intents/payment-intent.service';
import { PaymentMethodService } from '../src/payments/methods/payment-method.service';
import { TopUpService } from '../src/payments/topups/top-up.service';
import { WalletRepository } from '../src/payments/wallet/wallet.repository';
import { WalletService } from '../src/payments/wallet/wallet.service';
import { PaymentWebhookService } from '../src/payments/webhooks/payment-webhook.service';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Pix top-up, webhook and tokenized methods integration', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const publisher = new OutboxEventPublisher(prisma);
  const ledger = new LedgerService(new LedgerRepository(prisma), publisher);
  const wallet = new WalletService(new WalletRepository(prisma), ledger, publisher);
  const gateway = new MockPaymentGateway();
  const intents = new PaymentIntentService(prisma, publisher);
  const topUps = new TopUpService(prisma, intents, gateway, wallet);
  const webhooks = new PaymentWebhookService(prisma, gateway, topUps);
  const methods = new PaymentMethodService(prisma, publisher);
  let sequence = 0;

  function correlationId(): string {
    return `phase5-payment-${++sequence}`;
  }

  async function driver(): Promise<AuthUser> {
    const id = randomUUID();
    const user: AuthUser = {
      email: `${id}@payments.solis.local`,
      role: UserRole.DRIVER,
      sub: id,
      tenantId,
    };
    await prisma.user.create({
      data: {
        email: user.email,
        id,
        name: 'Payment Driver',
        passwordHash: 'integration-only',
        role: UserRole.DRIVER,
        tenantId,
      },
    });
    await wallet.createWallet(user);
    return user;
  }

  function signed(body: object, eventId: string) {
    const payload = { ...body, providerEventId: eventId };
    const rawBody = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', environment.paymentWebhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    return { body: payload, rawBody, signature, timestamp };
  }

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Payment integration',
        slug: `payments-${tenantId}`,
      },
    });
    await prisma.paymentPolicyConfig.create({
      data: {
        currency: 'BRL',
        lowBalanceWarningMinor: 2_000n,
        maximumSessionAmountMinor: 50_000n,
        maximumTopUpAmountMinor: 200_000n,
        minimumTopUpAmountMinor: 5_000n,
        minimumWalletBalanceMinor: 2_000n,
        preAuthorizationAmountMinor: 5_000n,
        tenantId,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('credits a confirmed Pix exactly once under concurrent duplicate webhooks', async () => {
    const user = await driver();
    const topUp = await topUps.create(
      {
        amountMinor: '10000',
        currency: 'BRL',
        idempotencyKey: 'pix-credit-once',
        method: 'PIX',
      },
      user,
    );
    expect(topUp.status).toBe(PaymentIntentStatus.PENDING);
    expect((await wallet.get(user)).availableBalanceMinor).toBe('0');
    const stored = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: topUp.id },
    });
    const event = signed(
      {
        amountMinor: '10000',
        currency: 'BRL',
        eventType: 'PIX_CONFIRMED',
        providerReference: stored.providerReference!,
        status: 'APPROVED',
      },
      `pix-event-once-${topUp.id}`,
    );
    const results = await Promise.all([
      webhooks.handle({
        ...event,
        correlationId: correlationId(),
        provider: gateway.provider,
      }),
      webhooks.handle({
        ...event,
        correlationId: correlationId(),
        provider: gateway.provider,
      }),
    ]);
    expect(results.some((result) => result.duplicate)).toBe(true);
    expect((await wallet.get(user)).availableBalanceMinor).toBe('10000');
    expect((await intents.get(topUp.id, user)).status).toBe(
      PaymentIntentStatus.CAPTURED,
    );
    expect(
      await prisma.ledgerTransaction.count({
        where: {
          idempotencyKey: `wallet:credit:topup-webhook:${topUp.id}`,
          tenantId,
        },
      }),
    ).toBe(1);
    expect((await wallet.transactions(user, { limit: 10 })).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amountMinor: '10000',
          paymentIntentId: topUp.id,
          type: LedgerTransactionType.TOP_UP,
        }),
      ]),
    );
  });

  it('rejects invalid signatures, replay payload conflicts and amount tampering', async () => {
    const user = await driver();
    const topUp = await topUps.create(
      {
        amountMinor: '5000',
        currency: 'BRL',
        idempotencyKey: 'pix-secure',
        method: 'PIX',
      },
      user,
    );
    const stored = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: topUp.id },
    });
    const valid = signed(
      {
        amountMinor: '5001',
        currency: 'BRL',
        eventType: 'PIX_CONFIRMED',
        providerReference: stored.providerReference!,
        status: 'APPROVED',
      },
      `tampered-event-${topUp.id}`,
    );
    await expect(
      webhooks.handle({
        ...valid,
        correlationId: correlationId(),
        provider: gateway.provider,
        signature: '00',
      }),
    ).rejects.toThrow('signature');
    await webhooks.handle({
      ...valid,
      correlationId: correlationId(),
      provider: gateway.provider,
    });
    expect((await intents.get(topUp.id, user)).status).toBe(
      PaymentIntentStatus.REQUIRES_REVIEW,
    );
    expect((await wallet.get(user)).availableBalanceMinor).toBe('0');

    const conflicting = signed(
      {
        amountMinor: '9999',
        currency: 'BRL',
        eventType: 'PIX_CONFIRMED',
        providerReference: stored.providerReference!,
        status: 'APPROVED',
      },
      `tampered-event-${topUp.id}`,
    );
    await expect(
      webhooks.handle({
        ...conflicting,
        correlationId: correlationId(),
        provider: gateway.provider,
      }),
    ).rejects.toMatchObject({
      response: { code: 'WEBHOOK_REPLAY_CONFLICT' },
    });
  });

  it('creates one intent for concurrent identical requests and binds the payload', async () => {
    const user = await driver();
    const input = {
      amountMinor: '5000',
      currency: 'BRL',
      idempotencyKey: `concurrent-create-${randomUUID()}`,
      method: 'PIX' as const,
      scenario: 'pending' as const,
    };
    const [first, second] = await Promise.all([
      topUps.create(input, user),
      topUps.create(input, user),
    ]);
    expect(first.id).toBe(second.id);
    expect(
      await prisma.paymentIntent.count({
        where: {
          idempotencyKey: `topup:${user.sub}:${input.idempotencyKey}`,
          tenantId,
        },
      }),
    ).toBe(1);
    await expect(
      topUps.create({ ...input, amountMinor: '6000' }, user),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' },
    });
  });

  it('reprocesses the same signed event only after a failed attempt', async () => {
    const user = await driver();
    const topUp = await topUps.create(
      {
        amountMinor: '5000',
        currency: 'BRL',
        idempotencyKey: `webhook-retry-${randomUUID()}`,
        method: 'PIX',
      },
      user,
    );
    const stored = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: topUp.id },
    });
    const eventId = `retry-event-${topUp.id}`;
    const event = signed(
      {
        amountMinor: '5000',
        currency: 'BRL',
        eventType: 'PIX_CONFIRMED',
        providerReference: stored.providerReference!,
        status: 'APPROVED',
      },
      eventId,
    );
    const original = topUps.applyWebhook.bind(topUps);
    const failure = jest
      .spyOn(topUps, 'applyWebhook')
      .mockRejectedValueOnce(new Error('temporary provider processing failure'))
      .mockImplementation(original);
    await expect(
      webhooks.handle({
        ...event,
        correlationId: correlationId(),
        provider: gateway.provider,
      }),
    ).rejects.toThrow('temporary provider processing failure');
    expect(
      (
        await prisma.paymentWebhookEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: {
              provider: gateway.provider,
              providerEventId: eventId,
            },
          },
        })
      ).processingStatus,
    ).toBe(PaymentWebhookProcessingStatus.FAILED);

    await expect(
      webhooks.handle({
        ...event,
        correlationId: correlationId(),
        provider: gateway.provider,
      }),
    ).resolves.toEqual({ accepted: true, duplicate: true });
    failure.mockRestore();
    expect((await wallet.get(user)).availableBalanceMinor).toBe('5000');
    expect(
      (
        await prisma.paymentWebhookEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: {
              provider: gateway.provider,
              providerEventId: eventId,
            },
          },
        })
      ).processingStatus,
    ).toBe(PaymentWebhookProcessingStatus.PROCESSED);
  });

  it('cancels pending Pix idempotently and never credits from display state', async () => {
    const user = await driver();
    const topUp = await topUps.create(
      {
        amountMinor: '5000',
        currency: 'BRL',
        idempotencyKey: 'pix-cancel',
        method: 'PIX',
      },
      user,
    );
    expect((await topUps.cancel(topUp.id, user)).status).toBe(
      PaymentIntentStatus.CANCELLED,
    );
    expect((await topUps.cancel(topUp.id, user)).status).toBe(
      PaymentIntentStatus.CANCELLED,
    );
    expect((await wallet.get(user)).availableBalanceMinor).toBe('0');
  });

  it('stores only mock tokens and masked payment method data with ownership', async () => {
    const owner = await driver();
    const stranger = await driver();
    const first = await methods.create(
      {
        brand: 'Solis Test',
        expirationMonth: 12,
        expirationYear: 2099,
        isDefault: true,
        lastFour: '4242',
        type: PaymentMethodType.CARD,
      },
      owner,
      correlationId(),
    );
    const second = await methods.create(
      { isDefault: false, type: PaymentMethodType.WALLET },
      owner,
      correlationId(),
    );
    expect(first).not.toHaveProperty('providerToken');
    const stored = await prisma.paymentMethod.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(stored.providerToken).toMatch(/^mock_[a-f0-9]+$/);
    expect(stored.providerToken).not.toContain('4242');
    expect((await methods.setDefault(second.id, owner, correlationId()))[0]).toMatchObject({
      id: second.id,
      isDefault: true,
    });
    await expect(
      methods.setDefault(first.id, stranger, correlationId()),
    ).rejects.toThrow('nao encontrado');
    await methods.remove(second.id, owner, correlationId());
    expect((await methods.list(owner)).some((method) => method.id === second.id)).toBe(
      false,
    );
  });
});
