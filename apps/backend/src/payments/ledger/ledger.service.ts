import { ConflictException, Injectable } from '@nestjs/common';
import {
  type LedgerAccount,
  type LedgerAccountOwnerType,
  LedgerAccountStatus,
  type LedgerAccountType,
  LedgerDirection,
  LedgerTransactionStatus,
  LedgerTransactionType,
  Prisma,
} from '@solis/database';

import { DomainEventPublisher } from '../../outbox/domain-event-publisher';
import { financialRequestHash } from '../financial-request-hash';
import { Money } from '../money';
import {
  type FinancialClient,
  LedgerRepository,
} from './ledger.repository';

export interface LedgerPostingEntry {
  accountId: string;
  direction: LedgerDirection;
  money: Money;
}

export interface LedgerPosting {
  chargingSessionId?: string;
  description: string;
  entries: readonly LedgerPostingEntry[];
  externalReference?: string;
  idempotencyKey: string;
  metadata?: Record<string, string | boolean | null>;
  paymentIntentId?: string;
  tenantId: string;
  type: LedgerTransactionType;
  userId?: string;
}

export interface LedgerPostingResult {
  replayed: boolean;
  transaction: Awaited<ReturnType<LedgerRepository['findTransaction']>> & {};
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly repository: LedgerRepository,
    private readonly outbox: DomainEventPublisher,
  ) {}

  account(
    client: FinancialClient,
    input: {
      accountType: LedgerAccountType;
      currency: string;
      ownerId: string;
      ownerType?: LedgerAccountOwnerType;
      tenantId: string;
    },
  ): Prisma.PrismaPromise<LedgerAccount> {
    return this.repository.account(client, input);
  }

  async post(
    input: LedgerPosting,
    client?: Prisma.TransactionClient,
  ): Promise<LedgerPostingResult> {
    if (client) return this.postInTransaction(input, client);
    return this.repository.client().$transaction(
      (transaction) => this.postInTransaction(input, transaction),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reverse(
    tenantId: string,
    transactionId: string,
    idempotencyKey: string,
    userId?: string,
  ): Promise<LedgerPostingResult> {
    return this.repository.client().$transaction(
      async (client) => {
        const original = await this.repository.findTransactionById(
          client,
          tenantId,
          transactionId,
        );
        if (!original) throw new ConflictException('Ledger transaction not found.');
        if (
          original.status !== LedgerTransactionStatus.POSTED &&
          original.status !== LedgerTransactionStatus.REVERSED
        ) {
          throw new ConflictException('Only a posted ledger transaction can be reversed.');
        }

        const result = await this.postInTransaction(
          {
            description: `Reversal: ${original.description}`.slice(0, 240),
            entries: original.entries.map((entry) => ({
              accountId: entry.accountId,
              direction:
                entry.direction === LedgerDirection.DEBIT
                  ? LedgerDirection.CREDIT
                  : LedgerDirection.DEBIT,
              money: Money.fromMinorUnits(entry.amountMinor, entry.currency),
            })),
            externalReference: original.id,
            idempotencyKey,
            metadata: { reversalOfId: original.id },
            tenantId,
            type: LedgerTransactionType.REVERSAL,
            userId,
          },
          client,
          original.id,
        );

        if (!result.replayed && original.status === LedgerTransactionStatus.POSTED) {
          await client.ledgerTransaction.update({
            data: { reversedAt: new Date(), status: LedgerTransactionStatus.REVERSED },
            where: { id: original.id },
          });
        }
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async postInTransaction(
    input: LedgerPosting,
    client: Prisma.TransactionClient,
    reversalOfId?: string,
  ): Promise<LedgerPostingResult> {
    const requestHash = financialRequestHash({
      chargingSessionId: input.chargingSessionId ?? null,
      description: input.description,
      entries: input.entries.map((entry) => ({
        accountId: entry.accountId,
        amountMinor: entry.money.amountMinor,
        currency: entry.money.currency,
        direction: entry.direction,
      })),
      paymentIntentId: input.paymentIntentId ?? null,
      reversalOfId: reversalOfId ?? null,
      type: input.type,
    });
    const existing = await this.repository.findTransaction(
      client,
      input.tenantId,
      input.idempotencyKey,
    );
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          message: 'The idempotency key was already used with another payload.',
        });
      }
      return { replayed: true, transaction: existing };
    }

    this.assertBalanced(input.entries);
    const accountIds = [...new Set(input.entries.map((entry) => entry.accountId))];
    const accounts = await client.ledgerAccount.findMany({
      where: { id: { in: accountIds }, tenantId: input.tenantId },
    });
    if (
      accounts.length !== accountIds.length ||
      accounts.some((account) => account.status !== LedgerAccountStatus.ACTIVE)
    ) {
      throw new ConflictException('Ledger account is missing, blocked or cross-tenant.');
    }
    const accountCurrencies = new Map(
      accounts.map((account) => [account.id, account.currency]),
    );
    if (
      input.entries.some(
        (entry) => accountCurrencies.get(entry.accountId) !== entry.money.currency,
      )
    ) {
      throw new ConflictException('Ledger entry currency differs from its account.');
    }

    const pending = await client.ledgerTransaction.create({
      data: {
        chargingSessionId: input.chargingSessionId,
        description: input.description.slice(0, 240),
        entries: {
          create: input.entries.map((entry) => ({
            accountId: entry.accountId,
            amountMinor: entry.money.amountMinor,
            currency: entry.money.currency,
            direction: entry.direction,
          })),
        },
        externalReference: input.externalReference,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
        paymentIntentId: input.paymentIntentId,
        requestHash,
        reversalOfId,
        status: LedgerTransactionStatus.PENDING,
        tenantId: input.tenantId,
        type: input.type,
      },
      include: { entries: true },
    });
    const posted = await client.ledgerTransaction.update({
      data: { status: LedgerTransactionStatus.POSTED },
      include: { entries: true },
      where: { id: pending.id },
    });
    await client.auditLog.create({
      data: {
        action: 'LEDGER_TRANSACTION_POSTED',
        after: { status: posted.status, type: posted.type },
        entityId: posted.id,
        entityType: 'LedgerTransaction',
        tenantId: input.tenantId,
        userId: input.userId,
      },
    });
    await this.outbox.publish(
      {
        aggregateId: posted.id,
        aggregateType: 'LedgerTransaction',
        eventType: 'LedgerTransactionPosted',
        payload: { status: posted.status, type: posted.type },
        tenantId: input.tenantId,
      },
      client,
    );
    return { replayed: false, transaction: posted };
  }

  private assertBalanced(entries: readonly LedgerPostingEntry[]): void {
    if (entries.length < 2) throw new ConflictException('Ledger requires two entries.');
    const currency = entries[0]!.money.currency;
    if (entries.some((entry) => entry.money.currency !== currency)) {
      throw new ConflictException('Ledger transaction cannot mix currencies.');
    }
    const debits = entries
      .filter((entry) => entry.direction === LedgerDirection.DEBIT)
      .reduce((sum, entry) => sum + entry.money.amountMinor, 0n);
    const credits = entries
      .filter((entry) => entry.direction === LedgerDirection.CREDIT)
      .reduce((sum, entry) => sum + entry.money.amountMinor, 0n);
    if (debits <= 0n || debits !== credits) {
      throw new ConflictException('Ledger transaction is not balanced.');
    }
  }
}
