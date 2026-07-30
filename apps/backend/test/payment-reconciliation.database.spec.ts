import { randomUUID } from 'node:crypto';
import {
  PaymentIntentStatus,
  PaymentIntentType,
  PaymentReconciliationStatus,
  UserRole,
} from '@solis/database';

import type { AuthUser } from '../src/auth/auth-user';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxEventPublisher } from '../src/outbox/outbox-event.publisher';
import { RedisService } from '../src/redis/redis.service';
import { MockPaymentGateway } from '../src/payments/gateway/mock-payment.gateway';
import { PaymentIntentService } from '../src/payments/intents/payment-intent.service';
import { LedgerRepository } from '../src/payments/ledger/ledger.repository';
import { LedgerService } from '../src/payments/ledger/ledger.service';
import { Money } from '../src/payments/money';
import { PaymentReconciliationService } from '../src/payments/reconciliation/payment-reconciliation.service';
import { TopUpService } from '../src/payments/topups/top-up.service';
import { WalletRepository } from '../src/payments/wallet/wallet.repository';
import { WalletService } from '../src/payments/wallet/wallet.service';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('payment reconciliation with distributed locking', () => {
  const prisma = new PrismaService();
  const redis = new RedisService();
  const publisher = new OutboxEventPublisher(prisma);
  const ledger = new LedgerService(new LedgerRepository(prisma), publisher);
  const wallets = new WalletService(
    new WalletRepository(prisma),
    ledger,
    publisher,
  );
  const gateway = new MockPaymentGateway();
  const intents = new PaymentIntentService(prisma, publisher);
  const topUps = new TopUpService(prisma, intents, gateway, wallets);
  const reconciliation = new PaymentReconciliationService(
    prisma,
    redis,
    gateway,
  );
  const tenantId = randomUUID();
  let user: AuthUser;

  beforeAll(async () => {
    await prisma.$connect();
    await redis.onModuleInit();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Reconciliation integration',
        slug: `reconciliation-${tenantId}`,
      },
    });
    const userId = randomUUID();
    user = {
      email: `${userId}@reconciliation.solis.local`,
      role: UserRole.DRIVER,
      sub: userId,
      tenantId,
    };
    await prisma.user.create({
      data: {
        email: user.email,
        id: userId,
        name: 'Reconciliation Driver',
        passwordHash: 'integration-only',
        role: UserRole.DRIVER,
        tenantId,
      },
    });
    await wallets.createWallet(user);
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
    await redis.client.del('payments:reconciliation:global');
    await redis.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('records matching, missing, status and amount divergence without changing ledger', async () => {
    const matched = await topUps.create(
      {
        amountMinor: '5000',
        currency: 'BRL',
        idempotencyKey: `reconciliation-match-${randomUUID()}`,
        method: 'PIX',
      },
      user,
    );
    const missing = await intents.create(
      {
        idempotencyKey: `reconciliation-missing-${randomUUID()}`,
        money: Money.fromMinorUnits(5_000n),
        provider: gateway.provider,
        providerReference: `missing_${randomUUID()}`,
        type: PaymentIntentType.WALLET_TOP_UP,
      },
      user,
    );
    await intents.transition(
      missing.id,
      PaymentIntentStatus.PENDING,
      user,
    );
    const amountMismatch = await topUps.create(
      {
        amountMinor: '5000',
        currency: 'BRL',
        idempotencyKey: `reconciliation-amount-${randomUUID()}`,
        method: 'PIX',
      },
      user,
    );
    await prisma.paymentIntent.update({
      data: { amountMinor: 5_001n },
      where: { id: amountMismatch.id },
    });
    const statusMismatch = await topUps.create(
      {
        amountMinor: '5000',
        currency: 'BRL',
        idempotencyKey: `reconciliation-status-${randomUUID()}`,
        method: 'PIX',
      },
      user,
    );
    await prisma.paymentIntent.update({
      data: { status: PaymentIntentStatus.REQUIRES_REVIEW },
      where: { id: statusMismatch.id },
    });
    const ledgerBefore = await prisma.ledgerTransaction.count({
      where: { tenantId },
    });

    const result = await reconciliation.run();
    expect(result.locked).toBe(false);
    expect(result.processed).toBeGreaterThanOrEqual(4);
    const records = await prisma.paymentReconciliation.findMany({
      where: {
        paymentIntentId: {
          in: [matched.id, missing.id, amountMismatch.id, statusMismatch.id],
        },
      },
    });
    expect(
      new Map(records.map((record) => [record.paymentIntentId, record.status])),
    ).toEqual(
      new Map([
        [matched.id, PaymentReconciliationStatus.MATCHED],
        [missing.id, PaymentReconciliationStatus.MISSING_AT_PROVIDER],
        [amountMismatch.id, PaymentReconciliationStatus.AMOUNT_MISMATCH],
        [statusMismatch.id, PaymentReconciliationStatus.STATUS_MISMATCH],
      ]),
    );
    expect(
      await prisma.ledgerTransaction.count({ where: { tenantId } }),
    ).toBe(ledgerBefore);
  });

  it('allows only one active reconciliation process', async () => {
    await redis.client.set(
      'payments:reconciliation:global',
      'external-worker',
      'PX',
      60_000,
    );
    await expect(reconciliation.run()).resolves.toEqual({
      locked: true,
      mismatches: 0,
      processed: 0,
    });
  });
});
