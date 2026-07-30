import { randomUUID } from 'node:crypto';
import {
  LedgerAccountType,
  LedgerDirection,
  LedgerTransactionStatus,
  LedgerTransactionType,
  UserRole,
  WalletStatus,
} from '@solis/database';

import type { AuthUser } from '../src/auth/auth-user';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxEventPublisher } from '../src/outbox/outbox-event.publisher';
import { LedgerRepository } from '../src/payments/ledger/ledger.repository';
import { LedgerService } from '../src/payments/ledger/ledger.service';
import { Money } from '../src/payments/money';
import { WalletRepository } from '../src/payments/wallet/wallet.repository';
import { WalletService } from '../src/payments/wallet/wallet.service';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('immutable ledger and wallet PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const publisher = new OutboxEventPublisher(prisma);
  const ledger = new LedgerService(new LedgerRepository(prisma), publisher);
  const wallets = new WalletService(
    new WalletRepository(prisma),
    ledger,
    publisher,
  );
  let sequence = 0;

  const correlationId = () => `phase5-wallet-${++sequence}`;

  async function driver(initialBalanceMinor = 0n): Promise<AuthUser> {
    const id = randomUUID();
    const user: AuthUser = {
      email: `${id}@phase5.solis.local`,
      role: UserRole.DRIVER,
      sub: id,
      tenantId,
    };
    await prisma.user.create({
      data: {
        email: user.email,
        id,
        name: 'Phase 5 Driver',
        passwordHash: 'integration-only',
        role: UserRole.DRIVER,
        tenantId,
      },
    });
    await wallets.createWallet(user);
    if (initialBalanceMinor > 0n) {
      await wallets.credit({
        correlationId: correlationId(),
        idempotencyKey: `initial-${id}`,
        money: Money.fromMinorUnits(initialBalanceMinor),
        user,
      });
    }
    return user;
  }

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Phase 5 integration',
        slug: `phase5-integration-${tenantId}`,
      },
    });
  });

  afterAll(async () => {
    // Financial rows are intentionally immutable and are not physically deleted.
    await prisma.$disconnect();
  });

  it('credits exactly once and rejects key reuse with a different payload', async () => {
    const user = await driver();
    const operation = {
      correlationId: correlationId(),
      idempotencyKey: 'same-credit',
      money: Money.fromMinorUnits(10_000n),
      user,
    };
    const first = await wallets.credit(operation);
    const replay = await wallets.credit(operation);
    expect(first.availableBalanceMinor).toBe('10000');
    expect(replay.availableBalanceMinor).toBe('10000');
    await expect(
      wallets.credit({ ...operation, money: Money.fromMinorUnits(9_999n) }),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' },
    });
    expect(
      await prisma.ledgerTransaction.count({
        where: { idempotencyKey: 'wallet:credit:same-credit', tenantId },
      }),
    ).toBe(1);
  });

  it('allows only one concurrent reservation against the same balance', async () => {
    const user = await driver(10_000n);
    const attempts = await Promise.allSettled([
      wallets.reserve({
        correlationId: correlationId(),
        idempotencyKey: 'concurrent-a',
        money: Money.fromMinorUnits(6_000n),
        user,
      }),
      wallets.reserve({
        correlationId: correlationId(),
        idempotencyKey: 'concurrent-b',
        money: Money.fromMinorUnits(6_000n),
        user,
      }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '4000',
      reservedBalanceMinor: '6000',
    });
  });

  it('captures the final amount, releases excess and cannot capture twice differently', async () => {
    const user = await driver(10_000n);
    const reservation = await wallets.reserve({
      correlationId: correlationId(),
      idempotencyKey: 'capture-reserve',
      money: Money.fromMinorUnits(5_000n),
      user,
    });
    const settled = await wallets.captureReserved(reservation.id, {
      correlationId: correlationId(),
      idempotencyKey: 'capture-final',
      money: Money.fromMinorUnits(3_200n),
      user,
    });
    expect(settled).toMatchObject({
      availableBalanceMinor: '6800',
      reservedBalanceMinor: '0',
    });
    expect(
      await wallets.captureReserved(reservation.id, {
        correlationId: correlationId(),
        idempotencyKey: 'capture-final-replay',
        money: Money.fromMinorUnits(3_200n),
        user,
      }),
    ).toMatchObject({ availableBalanceMinor: '6800' });
    await expect(
      wallets.captureReserved(reservation.id, {
        correlationId: correlationId(),
        idempotencyKey: 'capture-wrong',
        money: Money.fromMinorUnits(3_201n),
        user,
      }),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' },
    });
  });

  it('releases an authorization, refunds and enforces wallet blocking', async () => {
    const user = await driver(5_000n);
    const reservation = await wallets.reserve({
      correlationId: correlationId(),
      idempotencyKey: 'release-reserve',
      money: Money.fromMinorUnits(2_000n),
      user,
    });
    await wallets.releaseReserved(reservation.id, {
      correlationId: correlationId(),
      idempotencyKey: 'release-all',
      user,
    });
    await wallets.refund({
      correlationId: correlationId(),
      idempotencyKey: 'refund-one',
      money: Money.fromMinorUnits(500n),
      user,
    });
    expect(await wallets.get(user)).toMatchObject({
      availableBalanceMinor: '5500',
      reservedBalanceMinor: '0',
    });
    await wallets.setBlocked(user, true, correlationId());
    await expect(
      wallets.reserve({
        correlationId: correlationId(),
        idempotencyKey: 'blocked-reserve',
        money: Money.fromMinorUnits(100n),
        user,
      }),
    ).rejects.toMatchObject({ response: { code: 'WALLET_NOT_ACTIVE' } });
    expect((await wallets.setBlocked(user, false, correlationId())).status).toBe(
      WalletStatus.ACTIVE,
    );
  });

  it('derives a paginated user statement without exposing account ids', async () => {
    const user = await driver();
    await wallets.credit({
      correlationId: correlationId(),
      idempotencyKey: 'statement-one',
      money: Money.fromMinorUnits(1_000n),
      user,
    });
    await wallets.credit({
      correlationId: correlationId(),
      idempotencyKey: 'statement-two',
      money: Money.fromMinorUnits(2_000n),
      user,
    });
    const first = await wallets.transactions(user, { limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    expect(first.items[0]).not.toHaveProperty('accountId');
    const second = await wallets.transactions(user, {
      cursor: first.nextCursor!,
      limit: 1,
    });
    expect(second.items).toHaveLength(1);
    await expect(wallets.transactions(user, { cursor: 'invalid' })).rejects.toThrow(
      'Cursor financeiro invalido',
    );
  });

  it('rejects unbalanced posting and enforces immutable posted entries in PostgreSQL', async () => {
    const user = await driver(1_000n);
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: {
        tenantId_userId_currency: { currency: 'BRL', tenantId, userId: user.sub },
      },
    });
    const account = await prisma.ledgerAccount.findFirstOrThrow({
      where: {
        accountType: LedgerAccountType.USER_WALLET_AVAILABLE,
        ownerId: wallet.id,
      },
    });
    const pending = await prisma.ledgerTransaction.create({
      data: {
        description: 'invalid unbalanced',
        entries: {
          create: {
            accountId: account.id,
            amountMinor: 1n,
            currency: 'BRL',
            direction: LedgerDirection.DEBIT,
          },
        },
        idempotencyKey: `invalid-${randomUUID()}`,
        requestHash: 'invalid',
        tenantId,
        type: LedgerTransactionType.ADJUSTMENT,
      },
      include: { entries: true },
    });
    await expect(
      prisma.ledgerTransaction.update({
        data: { status: LedgerTransactionStatus.POSTED },
        where: { id: pending.id },
      }),
    ).rejects.toBeDefined();

    const posted = await prisma.ledgerTransaction.findFirstOrThrow({
      include: { entries: true },
      where: { idempotencyKey: `wallet:credit:initial-${user.sub}`, tenantId },
    });
    await expect(
      prisma.ledgerEntry.update({
        data: { amountMinor: 999n },
        where: { id: posted.entries[0]!.id },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.ledgerTransaction.delete({ where: { id: posted.id } }),
    ).rejects.toBeDefined();
  });
});
