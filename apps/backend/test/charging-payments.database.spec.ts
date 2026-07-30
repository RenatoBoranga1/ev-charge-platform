import { randomUUID } from 'node:crypto';
import {
  ChargingSessionStatus,
  PaymentIntentStatus,
  PaymentIntentType,
  PlugType,
  UserRole,
  VehicleType,
} from '@solis/database';

import type { AuthUser } from '../src/auth/auth-user';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxEventPublisher } from '../src/outbox/outbox-event.publisher';
import type { AutoRechargeService } from '../src/payments/auto-recharge/auto-recharge.service';
import { ChargingPaymentPolicy } from '../src/payments/charging/charging-payment.policy';
import { PaymentIntentService } from '../src/payments/intents/payment-intent.service';
import { LedgerRepository } from '../src/payments/ledger/ledger.repository';
import { LedgerService } from '../src/payments/ledger/ledger.service';
import { Money } from '../src/payments/money';
import { ReceiptService } from '../src/payments/receipts/receipt.service';
import { RefundService } from '../src/payments/refunds/refund.service';
import { WalletRepository } from '../src/payments/wallet/wallet.repository';
import { WalletService } from '../src/payments/wallet/wallet.service';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('charging financial authorization and settlement', () => {
  const prisma = new PrismaService();
  const publisher = new OutboxEventPublisher(prisma);
  const ledger = new LedgerService(new LedgerRepository(prisma), publisher);
  const wallets = new WalletService(
    new WalletRepository(prisma),
    ledger,
    publisher,
  );
  const intents = new PaymentIntentService(prisma, publisher);
  const receipts = new ReceiptService(prisma, publisher);
  const refunds = new RefundService(prisma, wallets, publisher);
  const evaluateAutoRecharge = jest.fn().mockResolvedValue({
    reason: 'DISABLED',
    triggered: false,
  });
  const autoRecharge = {
    evaluate: evaluateAutoRecharge,
  } as unknown as AutoRechargeService;
  const policy = new ChargingPaymentPolicy(
    prisma,
    intents,
    wallets,
    receipts,
    autoRecharge,
  );
  const ids = {
    chargePoint: 'd744cb1e-9799-49f2-807c-f7e583cb30dc',
    connector: 'd7d92f80-36a3-47ec-bf60-b931453bdb39',
    evse: '13467910-0537-4b8a-a2de-e359df8ba7dc',
    station: 'ef5a80bb-2090-45cb-83cd-bc04fc5e9a01',
    tariff: '70707070-7070-4070-8070-707070707070',
  };
  let tenantId: string;
  let sequence = 0;

  const correlationId = () => `charging-payment-${++sequence}`;

  async function driver(initialBalanceMinor: bigint): Promise<AuthUser> {
    const id = randomUUID();
    const station = await prisma.station.findUniqueOrThrow({
      where: { id: ids.station },
    });
    const user: AuthUser = {
      email: `${id}@charging-payments.solis.local`,
      role: UserRole.DRIVER,
      sub: id,
      tenantId: station.tenantId,
    };
    await prisma.user.create({
      data: {
        email: user.email,
        id,
        name: 'Charging Payment Driver',
        passwordHash: 'integration-only',
        role: UserRole.DRIVER,
        tenantId: station.tenantId,
      },
    });
    await wallets.createWallet(user);
    if (initialBalanceMinor > 0n) {
      await wallets.credit({
        correlationId: correlationId(),
        idempotencyKey: `initial:${id}`,
        money: Money.fromMinorUnits(initialBalanceMinor),
        user,
      });
    }
    return user;
  }

  async function completedSession(user: AuthUser) {
    const completedAt = new Date();
    const vehicle = await prisma.vehicle.create({
      data: {
        batteryCapacityKwh: '60',
        brand: 'Solis',
        licensePlate: `T${user.sub.slice(0, 6)}`,
        model: 'Financial Test',
        supportedPlugTypes: [PlugType.TYPE_2],
        userId: user.sub,
        vehicleType: VehicleType.BEV,
      },
    });
    return prisma.chargingSession.create({
      data: {
        chargePointId: ids.chargePoint,
        completedAt,
        connectorId: ids.connector,
        energyKwh: '6.172',
        evseId: ids.evse,
        idempotencyKey: `financial-${randomUUID()}`,
        meterStartWh: 1000n,
        meterStopWh: 7172n,
        startedAt: new Date(completedAt.getTime() - 20 * 60 * 1000),
        stationId: ids.station,
        status: ChargingSessionStatus.COMPLETED,
        stoppedAt: completedAt,
        tariffId: ids.tariff,
        tariffSnapshot: {
          activationFee: 1,
          currency: 'BRL',
          initialBatteryPercent: 30,
          name: 'Financial snapshot',
          parkingFeeHour: 0,
          pricePerKwh: 2,
        },
        totalAmount: '12.34',
        userId: user.sub,
        vehicleId: vehicle.id,
      },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
    tenantId = (
      await prisma.station.findUniqueOrThrow({ where: { id: ids.station } })
    ).tenantId;
    await prisma.paymentPolicyConfig.upsert({
      create: {
        currency: 'BRL',
        lowBalanceWarningMinor: 2_000n,
        maximumSessionAmountMinor: 10_000n,
        maximumTopUpAmountMinor: 200_000n,
        minimumTopUpAmountMinor: 5_000n,
        minimumWalletBalanceMinor: 2_000n,
        preAuthorizationAmountMinor: 5_000n,
        tenantId,
      },
      update: {
        maximumSessionAmountMinor: 10_000n,
        preAuthorizationAmountMinor: 5_000n,
      },
      where: { tenantId_currency: { currency: 'BRL', tenantId } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('authorizes concurrently once, settles once and releases the excess', async () => {
    const user = await driver(10_000n);
    const session = await completedSession(user);
    const context = { chargingSessionId: session.id, currency: 'BRL' };
    const attempts = await Promise.all([
      policy.authorize(
        context,
        user,
        'same-authorization',
        correlationId(),
      ),
      policy.authorize(
        context,
        user,
        'same-authorization',
        correlationId(),
      ),
    ]);
    expect(new Set(attempts.map((attempt) => attempt.intentId)).size).toBe(1);
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '5000',
      reservedBalanceMinor: '5000',
    });

    const receipt = await policy.settle(
      context,
      Money.fromMinorUnits(1_234n),
      user,
      correlationId(),
    );
    const replay = await policy.settle(
      context,
      Money.fromMinorUnits(1_234n),
      user,
      correlationId(),
    );
    expect(replay?.receiptNumber).toBe(receipt?.receiptNumber);
    expect(receipt).toMatchObject({
      amountMinor: '1234',
      currency: 'BRL',
      status: 'ISSUED',
    });
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '8766',
      reservedBalanceMinor: '0',
    });
    expect(
      await prisma.ledgerTransaction.count({
        where: {
          chargingSessionId: session.id,
          type: { in: ['AUTHORIZATION', 'CAPTURE', 'RELEASE'] },
        },
      }),
    ).toBe(3);
    expect(evaluateAutoRecharge).toHaveBeenCalledTimes(1);
  });

  it('blocks insufficient funds without a reservation or negative balance', async () => {
    const user = await driver(0n);
    const session = await completedSession(user);
    await expect(
      policy.authorize(
        { chargingSessionId: session.id, currency: 'BRL' },
        user,
        'insufficient',
        correlationId(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_WALLET_BALANCE' },
    });
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '0',
      reservedBalanceMinor: '0',
    });
    const intent = await prisma.paymentIntent.findFirstOrThrow({
      where: {
        chargingSessionId: session.id,
        type: PaymentIntentType.CHARGING_AUTHORIZATION,
      },
    });
    expect(intent.status).toBe(PaymentIntentStatus.FAILED);
    expect(
      await prisma.walletReservation.count({
        where: { chargingSessionId: session.id },
      }),
    ).toBe(0);
  });

  it('cancels an authorization idempotently and restores the full balance', async () => {
    const user = await driver(5_000n);
    const session = await completedSession(user);
    const context = { chargingSessionId: session.id, currency: 'BRL' };
    await policy.authorize(context, user, 'cancel', correlationId());
    await policy.cancel(session.id, user, correlationId());
    await policy.cancel(session.id, user, correlationId());
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '5000',
      reservedBalanceMinor: '0',
    });
    const intent = await prisma.paymentIntent.findFirstOrThrow({
      where: { chargingSessionId: session.id },
    });
    expect(intent.status).toBe(PaymentIntentStatus.CANCELLED);
  });

  it('requires review instead of capturing above the authorization', async () => {
    const user = await driver(15_000n);
    const session = await completedSession(user);
    const context = { chargingSessionId: session.id, currency: 'BRL' };
    await policy.authorize(context, user, 'review', correlationId());
    await expect(
      policy.settle(
        context,
        Money.fromMinorUnits(5_001n),
        user,
        correlationId(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'CAPTURE_EXCEEDS_AUTHORIZATION' },
    });
    const intent = await prisma.paymentIntent.findFirstOrThrow({
      where: { chargingSessionId: session.id },
    });
    expect(intent.status).toBe(PaymentIntentStatus.REQUIRES_REVIEW);
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '10000',
      reservedBalanceMinor: '5000',
    });
  });

  it('refunds a captured session exactly once under concurrency', async () => {
    const user = await driver(10_000n);
    const session = await completedSession(user);
    const context = { chargingSessionId: session.id, currency: 'BRL' };
    await policy.authorize(context, user, 'refund-auth', correlationId());
    await policy.settle(
      context,
      Money.fromMinorUnits(1_234n),
      user,
      correlationId(),
    );
    const intent = await prisma.paymentIntent.findFirstOrThrow({
      where: { chargingSessionId: session.id },
    });
    const results = await Promise.all([
      refunds.refundCapturedPayment(
        intent.id,
        user,
        'refund-once',
        'Sessao contestada pela fixture administrativa',
        correlationId(),
      ),
      refunds.refundCapturedPayment(
        intent.id,
        user,
        'refund-once',
        'Sessao contestada pela fixture administrativa',
        correlationId(),
      ),
    ]);
    expect(new Set(results.map((refund) => refund.id)).size).toBe(1);
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '10000',
      reservedBalanceMinor: '0',
    });
    expect(
      await prisma.refund.count({
        where: { paymentIntentId: intent.id },
      }),
    ).toBe(1);
    expect(
      (await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } }))
        .status,
    ).toBe(PaymentIntentStatus.REFUNDED);
    expect(
      (await receipts.get(session.id, user)).status,
    ).toBe('REFUNDED');
    await expect(
      refunds.refundCapturedPayment(
        intent.id,
        user,
        'refund-once',
        'Motivo alterado',
        correlationId(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' },
    });
  });

  it('keeps a receipt isolated to its tenant and owner', async () => {
    const owner = await driver(10_000n);
    const stranger = await driver(0n);
    const session = await completedSession(owner);
    const context = { chargingSessionId: session.id, currency: 'BRL' };
    await policy.authorize(context, owner, 'receipt-owner', correlationId());
    await policy.settle(
      context,
      Money.fromMinorUnits(1_000n),
      owner,
      correlationId(),
    );
    await expect(receipts.get(session.id, stranger)).rejects.toThrow(
      'Recibo nao encontrado',
    );
  });
});
