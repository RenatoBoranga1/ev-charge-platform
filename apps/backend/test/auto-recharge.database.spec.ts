import { randomUUID } from 'node:crypto';
import { PaymentMethodType, UserRole } from '@solis/database';

import type { AuthUser } from '../src/auth/auth-user';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxEventPublisher } from '../src/outbox/outbox-event.publisher';
import { RedisService } from '../src/redis/redis.service';
import { AutoRechargeService } from '../src/payments/auto-recharge/auto-recharge.service';
import { MockPaymentGateway } from '../src/payments/gateway/mock-payment.gateway';
import { PaymentIntentService } from '../src/payments/intents/payment-intent.service';
import { LedgerRepository } from '../src/payments/ledger/ledger.repository';
import { LedgerService } from '../src/payments/ledger/ledger.service';
import { PaymentMethodService } from '../src/payments/methods/payment-method.service';
import { WalletRepository } from '../src/payments/wallet/wallet.repository';
import { WalletService } from '../src/payments/wallet/wallet.service';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('automatic wallet recharge integration', () => {
  const prisma = new PrismaService();
  const redis = new RedisService();
  const tenantId = randomUUID();
  const publisher = new OutboxEventPublisher(prisma);
  const ledger = new LedgerService(new LedgerRepository(prisma), publisher);
  const wallet = new WalletService(new WalletRepository(prisma), ledger, publisher);
  const gateway = new MockPaymentGateway();
  const intents = new PaymentIntentService(prisma, publisher);
  const methods = new PaymentMethodService(prisma, publisher);
  const autoRecharge = new AutoRechargeService(
    prisma,
    redis,
    gateway,
    intents,
    wallet,
    publisher,
  );
  let sequence = 0;
  const correlationId = () => `auto-recharge-${++sequence}`;

  async function setup() {
    const userId = randomUUID();
    const user: AuthUser = {
      email: `${userId}@auto.solis.local`,
      role: UserRole.DRIVER,
      sub: userId,
      tenantId,
    };
    await prisma.user.create({
      data: {
        email: user.email,
        id: userId,
        name: 'Auto Recharge Driver',
        passwordHash: 'integration-only',
        tenantId,
      },
    });
    await wallet.createWallet(user);
    const method = await methods.create(
      {
        brand: 'Solis Test',
        expirationMonth: 12,
        expirationYear: 2099,
        isDefault: true,
        lastFour: '4444',
        type: PaymentMethodType.CARD,
      },
      user,
      correlationId(),
    );
    return { method, user };
  }

  beforeAll(async () => {
    await prisma.$connect();
    await redis.onModuleInit();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Auto recharge integration',
        slug: `auto-${tenantId}`,
      },
    });
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('is disabled by default and requires explicit consent', async () => {
    const { method, user } = await setup();
    expect(await autoRecharge.get(user)).toMatchObject({ enabled: false });
    await expect(
      autoRecharge.update(
        {
          consentConfirmed: false,
          currency: 'BRL',
          enabled: true,
          minimumBalanceMinor: '5000',
          paymentMethodId: method.id,
          rechargeAmountMinor: '10000',
        },
        user,
        correlationId(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'AUTO_RECHARGE_CONSENT_REQUIRED' },
    });
  });

  it('credits once below the threshold and does not loop above it', async () => {
    const { method, user } = await setup();
    await autoRecharge.update(
      {
        consentConfirmed: true,
        currency: 'BRL',
        enabled: true,
        minimumBalanceMinor: '5000',
        paymentMethodId: method.id,
        rechargeAmountMinor: '10000',
      },
      user,
      correlationId(),
    );
    expect(await autoRecharge.evaluate(user, correlationId())).toMatchObject({
      triggered: true,
    });
    expect((await wallet.get(user)).availableBalanceMinor).toBe('10000');
    expect(await autoRecharge.evaluate(user, correlationId())).toEqual({
      reason: 'ABOVE_MINIMUM',
      triggered: false,
    });
    expect(
      await prisma.paymentIntent.count({
        where: { tenantId, userId: user.sub },
      }),
    ).toBe(1);
  });

  it('uses a distributed lock for concurrent evaluation', async () => {
    const { method, user } = await setup();
    await autoRecharge.update(
      {
        consentConfirmed: true,
        currency: 'BRL',
        enabled: true,
        minimumBalanceMinor: '5000',
        paymentMethodId: method.id,
        rechargeAmountMinor: '10000',
      },
      user,
      correlationId(),
    );
    const lockKey = `payments:auto-recharge:${tenantId}:${user.sub}`;
    await redis.client.set(lockKey, 'external-lock', 'PX', 10_000);
    expect(await autoRecharge.evaluate(user, correlationId())).toEqual({
      reason: 'LOCKED',
      triggered: false,
    });
    await redis.client.del(lockKey);
  });

  it('can be disabled without deleting the consent history', async () => {
    const { method, user } = await setup();
    await autoRecharge.update(
      {
        consentConfirmed: true,
        currency: 'BRL',
        enabled: true,
        minimumBalanceMinor: '100',
        paymentMethodId: method.id,
        rechargeAmountMinor: '5000',
      },
      user,
      correlationId(),
    );
    expect(await autoRecharge.disable(user, correlationId())).toMatchObject({
      enabled: false,
    });
    expect(await autoRecharge.evaluate(user, correlationId())).toEqual({
      reason: 'DISABLED',
      triggered: false,
    });
  });
});
