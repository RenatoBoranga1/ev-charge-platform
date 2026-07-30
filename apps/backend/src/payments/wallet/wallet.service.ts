import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerAccountOwnerType,
  LedgerAccountType,
  LedgerDirection,
  LedgerTransactionStatus,
  LedgerTransactionType,
  Prisma,
  WalletReservationStatus,
  WalletStatus,
} from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { DomainEventPublisher } from '../../outbox/domain-event-publisher';
import { financialRequestHash } from '../financial-request-hash';
import { LedgerService } from '../ledger/ledger.service';
import { Money } from '../money';
import { WalletRepository } from './wallet.repository';

interface WalletOperation {
  correlationId: string;
  currency?: string;
  idempotencyKey: string;
  ledgerType?: LedgerTransactionType;
  money: Money;
  paymentIntentId?: string;
  user: AuthUser;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly repository: WalletRepository,
    private readonly ledger: LedgerService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async createWallet(user: AuthUser, currency = 'BRL') {
    return this.serializableTransaction(
      async (client) => {
        const existing = await client.wallet.findUnique({
          where: {
            tenantId_userId_currency: {
              currency,
              tenantId: user.tenantId,
              userId: user.sub,
            },
          },
        });
        if (existing) return this.toDto(existing);

        const wallet = await client.wallet.create({
          data: { currency, tenantId: user.tenantId, userId: user.sub },
        });
        await this.accounts(client, wallet.id, user.tenantId, currency);
        await client.auditLog.create({
          data: {
            action: 'WALLET_CREATED',
            after: { currency, status: wallet.status },
            entityId: wallet.id,
            entityType: 'Wallet',
            tenantId: user.tenantId,
            userId: user.sub,
          },
        });
        await this.outbox.publish(
          {
            aggregateId: wallet.id,
            aggregateType: 'Wallet',
            eventType: 'WalletCreated',
            payload: { currency, userId: user.sub },
            tenantId: user.tenantId,
          },
          client,
        );
        return this.toDto(wallet);
      },
    );
  }

  async get(user: AuthUser, currency = 'BRL') {
    const wallet = await this.repository.findOwned(
      user.tenantId,
      user.sub,
      currency,
    );
    if (!wallet) throw new NotFoundException('Carteira nao encontrada.');
    return this.toDto(wallet);
  }

  async credit(input: WalletOperation) {
    return this.serializableTransaction(
      async (client) => {
        const currency = input.currency ?? input.money.currency;
        const wallet = await this.lockActiveWallet(
          client,
          input.user,
          currency,
        );
        const accounts = await this.accounts(
          client,
          wallet.id,
          input.user.tenantId,
          currency,
        );
        const posting = await this.ledger.post(
          {
            description: 'Credito na carteira Solis',
            entries: [
              {
                accountId: accounts.clearing.id,
                direction: LedgerDirection.DEBIT,
                money: input.money,
              },
              {
                accountId: accounts.available.id,
                direction: LedgerDirection.CREDIT,
                money: input.money,
              },
            ],
            idempotencyKey: `wallet:credit:${input.idempotencyKey}`,
            paymentIntentId: input.paymentIntentId,
            tenantId: input.user.tenantId,
            type: input.ledgerType ?? LedgerTransactionType.TOP_UP,
            userId: input.user.sub,
          },
          client,
        );
        if (!posting.replayed) {
          await client.wallet.update({
            data: {
              availableBalanceMinor: { increment: input.money.amountMinor },
              version: { increment: 1 },
            },
            where: { id: wallet.id },
          });
          await this.recordWalletEvent(
            client,
            input.user,
            wallet.id,
            'WALLET_CREDITED',
            'WalletCredited',
            input.money,
            input.correlationId,
          );
        }
        return this.currentDto(client, wallet.id);
      },
    );
  }

  async reserve(
    input: WalletOperation & {
      chargingSessionId?: string;
      paymentIntentId?: string;
    },
  ) {
    return this.serializableTransaction(
      async (client) => {
        const currency = input.currency ?? input.money.currency;
        const wallet = await this.lockActiveWallet(client, input.user, currency);
        const requestHash = financialRequestHash({
          amountMinor: input.money.amountMinor,
          chargingSessionId: input.chargingSessionId ?? null,
          currency,
          paymentIntentId: input.paymentIntentId ?? null,
        });
        const key = `wallet:reserve:${input.idempotencyKey}`;
        const existing = await client.walletReservation.findUnique({
          where: {
            walletId_idempotencyKey: {
              idempotencyKey: key,
              walletId: wallet.id,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
              message: 'Idempotency-Key reutilizada com outro valor.',
            });
          }
          return this.reservationDto(existing);
        }
        if (wallet.availableBalanceMinor < input.money.amountMinor) {
          throw new ConflictException({
            code: 'INSUFFICIENT_WALLET_BALANCE',
            message: 'Saldo insuficiente para autorizar a recarga.',
          });
        }

        const accounts = await this.accounts(
          client,
          wallet.id,
          input.user.tenantId,
          currency,
        );
        const reservation = await client.walletReservation.create({
          data: {
            amountMinor: input.money.amountMinor,
            chargingSessionId: input.chargingSessionId,
            currency,
            idempotencyKey: key,
            paymentIntentId: input.paymentIntentId,
            requestHash,
            walletId: wallet.id,
          },
        });
        await this.ledger.post(
          {
            chargingSessionId: input.chargingSessionId,
            description: 'Pre-autorizacao para recarga Solis',
            entries: [
              {
                accountId: accounts.available.id,
                direction: LedgerDirection.DEBIT,
                money: input.money,
              },
              {
                accountId: accounts.reserved.id,
                direction: LedgerDirection.CREDIT,
                money: input.money,
              },
            ],
            idempotencyKey: key,
            paymentIntentId: input.paymentIntentId,
            tenantId: input.user.tenantId,
            type: LedgerTransactionType.AUTHORIZATION,
            userId: input.user.sub,
          },
          client,
        );
        await client.wallet.update({
          data: {
            availableBalanceMinor: { decrement: input.money.amountMinor },
            reservedBalanceMinor: { increment: input.money.amountMinor },
            version: { increment: 1 },
          },
          where: { id: wallet.id },
        });
        await this.recordWalletEvent(
          client,
          input.user,
          wallet.id,
          'WALLET_BALANCE_RESERVED',
          'WalletBalanceReserved',
          input.money,
          input.correlationId,
        );
        return this.reservationDto(reservation);
      },
    );
  }

  async captureReserved(
    reservationId: string,
    input: WalletOperation,
  ) {
    return this.serializableTransaction(
      async (client) => {
        const wallet = await this.lockActiveWallet(
          client,
          input.user,
          input.money.currency,
        );
        const reservation = await this.repository.lockReservation(
          client,
          reservationId,
          wallet.id,
        );
        if (!reservation) throw new NotFoundException('Reserva financeira nao encontrada.');
        if (reservation.status === WalletReservationStatus.CAPTURED) {
          if (reservation.capturedMinor !== input.money.amountMinor) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
              message: 'A reserva ja foi capturada com outro valor.',
            });
          }
          return this.currentDto(client, wallet.id);
        }
        if (reservation.status !== WalletReservationStatus.RESERVED) {
          throw new ConflictException('A reserva financeira nao esta ativa.');
        }
        if (input.money.amountMinor > reservation.amountMinor) {
          throw new ConflictException({
            code: 'CAPTURE_EXCEEDS_RESERVATION',
            message: 'Captura superior a reserva exige revisao manual.',
          });
        }

        const accounts = await this.accounts(
          client,
          wallet.id,
          input.user.tenantId,
          input.money.currency,
        );
        if (input.money.amountMinor > 0n) {
          await this.ledger.post(
            {
              chargingSessionId: reservation.chargingSessionId ?? undefined,
              description: 'Liquidacao de recarga Solis',
              entries: [
                {
                  accountId: accounts.reserved.id,
                  direction: LedgerDirection.DEBIT,
                  money: input.money,
                },
                {
                  accountId: accounts.revenue.id,
                  direction: LedgerDirection.CREDIT,
                  money: input.money,
                },
              ],
              idempotencyKey: `wallet:capture:${input.idempotencyKey}`,
              paymentIntentId: reservation.paymentIntentId ?? undefined,
              tenantId: input.user.tenantId,
              type: LedgerTransactionType.CAPTURE,
              userId: input.user.sub,
            },
            client,
          );
        }
        const releasedMinor = reservation.amountMinor - input.money.amountMinor;
        if (releasedMinor > 0n) {
          const released = Money.fromMinorUnits(
            releasedMinor,
            input.money.currency,
          );
          await this.ledger.post(
            {
              chargingSessionId: reservation.chargingSessionId ?? undefined,
              description: 'Liberacao do excedente da pre-autorizacao',
              entries: [
                {
                  accountId: accounts.reserved.id,
                  direction: LedgerDirection.DEBIT,
                  money: released,
                },
                {
                  accountId: accounts.available.id,
                  direction: LedgerDirection.CREDIT,
                  money: released,
                },
              ],
              idempotencyKey: `wallet:release-excess:${input.idempotencyKey}`,
              paymentIntentId: reservation.paymentIntentId ?? undefined,
              tenantId: input.user.tenantId,
              type: LedgerTransactionType.RELEASE,
              userId: input.user.sub,
            },
            client,
          );
        }

        await client.walletReservation.update({
          data: {
            capturedMinor: input.money.amountMinor,
            completedAt: new Date(),
            releasedMinor,
            status: WalletReservationStatus.CAPTURED,
            version: { increment: 1 },
          },
          where: { id: reservation.id },
        });
        await client.wallet.update({
          data: {
            availableBalanceMinor: { increment: releasedMinor },
            reservedBalanceMinor: { decrement: reservation.amountMinor },
            version: { increment: 1 },
          },
          where: { id: wallet.id },
        });
        await this.recordWalletEvent(
          client,
          input.user,
          wallet.id,
          'WALLET_BALANCE_CAPTURED',
          'WalletBalanceCaptured',
          input.money,
          input.correlationId,
        );
        return this.currentDto(client, wallet.id);
      },
    );
  }

  async releaseReserved(
    reservationId: string,
    input: Omit<WalletOperation, 'money'>,
  ) {
    return this.serializableTransaction(
      async (client) => {
        const currency = input.currency ?? 'BRL';
        const wallet = await this.lockActiveWallet(client, input.user, currency);
        const reservation = await this.repository.lockReservation(
          client,
          reservationId,
          wallet.id,
        );
        if (!reservation) throw new NotFoundException('Reserva financeira nao encontrada.');
        if (reservation.status === WalletReservationStatus.RELEASED) {
          return this.currentDto(client, wallet.id);
        }
        if (reservation.status !== WalletReservationStatus.RESERVED) {
          throw new ConflictException('A reserva financeira nao pode ser liberada.');
        }
        const money = Money.fromMinorUnits(reservation.amountMinor, currency);
        const accounts = await this.accounts(
          client,
          wallet.id,
          input.user.tenantId,
          currency,
        );
        await this.ledger.post(
          {
            description: 'Liberacao de pre-autorizacao Solis',
            entries: [
              {
                accountId: accounts.reserved.id,
                direction: LedgerDirection.DEBIT,
                money,
              },
              {
                accountId: accounts.available.id,
                direction: LedgerDirection.CREDIT,
                money,
              },
            ],
            idempotencyKey: `wallet:release:${input.idempotencyKey}`,
            tenantId: input.user.tenantId,
            type: LedgerTransactionType.RELEASE,
            userId: input.user.sub,
          },
          client,
        );
        await client.walletReservation.update({
          data: {
            completedAt: new Date(),
            releasedMinor: reservation.amountMinor,
            status: WalletReservationStatus.RELEASED,
            version: { increment: 1 },
          },
          where: { id: reservation.id },
        });
        await client.wallet.update({
          data: {
            availableBalanceMinor: { increment: reservation.amountMinor },
            reservedBalanceMinor: { decrement: reservation.amountMinor },
            version: { increment: 1 },
          },
          where: { id: wallet.id },
        });
        await this.recordWalletEvent(
          client,
          input.user,
          wallet.id,
          'WALLET_RESERVATION_RELEASED',
          'WalletReservationReleased',
          money,
          input.correlationId,
        );
        return this.currentDto(client, wallet.id);
      },
    );
  }

  async refund(input: WalletOperation) {
    return this.serializableTransaction(
      async (client) => {
        const wallet = await this.lockActiveWallet(
          client,
          input.user,
          input.money.currency,
        );
        const accounts = await this.accounts(
          client,
          wallet.id,
          input.user.tenantId,
          input.money.currency,
        );
        const posting = await this.ledger.post(
          {
            description: 'Estorno para carteira Solis',
            entries: [
              {
                accountId: accounts.refund.id,
                direction: LedgerDirection.DEBIT,
                money: input.money,
              },
              {
                accountId: accounts.available.id,
                direction: LedgerDirection.CREDIT,
                money: input.money,
              },
            ],
            idempotencyKey: `wallet:refund:${input.idempotencyKey}`,
            tenantId: input.user.tenantId,
            type: LedgerTransactionType.REFUND,
            userId: input.user.sub,
          },
          client,
        );
        if (!posting.replayed) {
          await client.wallet.update({
            data: {
              availableBalanceMinor: { increment: input.money.amountMinor },
              version: { increment: 1 },
            },
            where: { id: wallet.id },
          });
          await this.recordWalletEvent(
            client,
            input.user,
            wallet.id,
            'WALLET_REFUNDED',
            'WalletRefunded',
            input.money,
            input.correlationId,
          );
        }
        return this.currentDto(client, wallet.id);
      },
    );
  }

  async setBlocked(user: AuthUser, blocked: boolean, correlationId: string) {
    const wallet = await this.repository.client().wallet.findFirst({
      where: { currency: 'BRL', deletedAt: null, tenantId: user.tenantId, userId: user.sub },
    });
    if (!wallet) throw new NotFoundException('Carteira nao encontrada.');
    if (wallet.status === WalletStatus.CLOSED) {
      throw new ConflictException('Carteira encerrada nao pode ser reativada.');
    }
    const status = blocked ? WalletStatus.BLOCKED : WalletStatus.ACTIVE;
    const updated = await this.repository.client().wallet.update({
      data: { status, version: { increment: 1 } },
      where: { id: wallet.id },
    });
    await this.repository.client().auditLog.create({
      data: {
        action: blocked ? 'WALLET_BLOCKED' : 'WALLET_UNBLOCKED',
        after: { status },
        before: { status: wallet.status },
        correlationId,
        entityId: wallet.id,
        entityType: 'Wallet',
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    return this.toDto(updated);
  }

  async transactions(
    user: AuthUser,
    filters: {
      cursor?: string;
      from?: Date;
      limit?: number;
      status?: LedgerTransactionStatus;
      to?: Date;
      type?: LedgerTransactionType;
    },
  ) {
    const wallet = await this.repository.findOwned(user.tenantId, user.sub, 'BRL');
    if (!wallet) throw new NotFoundException('Carteira nao encontrada.');
    const accounts = await this.repository.client().ledgerAccount.findMany({
      select: { id: true },
      where: {
        ownerId: wallet.id,
        tenantId: user.tenantId,
        accountType: {
          in: [
            LedgerAccountType.USER_WALLET_AVAILABLE,
            LedgerAccountType.USER_WALLET_RESERVED,
          ],
        },
      },
    });
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const cursor = filters.cursor ? this.decodeCursor(filters.cursor) : null;
    const records = await this.repository.client().ledgerTransaction.findMany({
      include: { entries: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where: {
        createdAt: { gte: filters.from, lte: filters.to },
        entries: { some: { accountId: { in: accounts.map((item) => item.id) } } },
        status: filters.status,
        tenantId: user.tenantId,
        type: filters.type,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
    });
    const hasMore = records.length > limit;
    const selected = hasMore ? records.slice(0, limit) : records;
    const last = selected.at(-1);
    return {
      items: selected.map((transaction) => ({
        amountMinor: (transaction.entries[0]?.amountMinor ?? 0n).toString(),
        chargingSessionId: transaction.chargingSessionId,
        createdAt: transaction.createdAt.toISOString(),
        currency: transaction.entries[0]?.currency ?? 'BRL',
        description: transaction.description,
        direction: this.userDirection(transaction.type),
        id: transaction.id,
        paymentIntentId: transaction.paymentIntentId,
        status: transaction.status,
        type: transaction.type,
      })),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }

  private async accounts(
    client: Prisma.TransactionClient,
    walletId: string,
    tenantId: string,
    currency: string,
  ) {
    const [available, reserved, clearing, revenue, refund] = await Promise.all([
      this.ledger.account(client, {
        accountType: LedgerAccountType.USER_WALLET_AVAILABLE,
        currency,
        ownerId: walletId,
        tenantId,
      }),
      this.ledger.account(client, {
        accountType: LedgerAccountType.USER_WALLET_RESERVED,
        currency,
        ownerId: walletId,
        tenantId,
      }),
      this.ledger.account(client, {
        accountType: LedgerAccountType.PAYMENT_GATEWAY_CLEARING,
        currency,
        ownerId: tenantId,
        ownerType: LedgerAccountOwnerType.PLATFORM,
        tenantId,
      }),
      this.ledger.account(client, {
        accountType: LedgerAccountType.OPERATOR_REVENUE,
        currency,
        ownerId: tenantId,
        ownerType: LedgerAccountOwnerType.PLATFORM,
        tenantId,
      }),
      this.ledger.account(client, {
        accountType: LedgerAccountType.REFUND_CLEARING,
        currency,
        ownerId: tenantId,
        ownerType: LedgerAccountOwnerType.PLATFORM,
        tenantId,
      }),
    ]);
    return { available, clearing, refund, reserved, revenue };
  }

  private async lockActiveWallet(
    client: Prisma.TransactionClient,
    user: AuthUser,
    currency: string,
  ) {
    const wallet = await this.repository.lockOwned(
      client,
      user.tenantId,
      user.sub,
      currency,
    );
    if (!wallet) throw new NotFoundException('Carteira nao encontrada.');
    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new ConflictException({
        code: 'WALLET_NOT_ACTIVE',
        message: 'A carteira esta bloqueada ou encerrada.',
      });
    }
    return wallet;
  }

  private currentDto(client: Prisma.TransactionClient, walletId: string) {
    return client.wallet
      .findUniqueOrThrow({ where: { id: walletId } })
      .then((wallet) => this.toDto(wallet));
  }

  private toDto(wallet: {
    availableBalanceMinor: bigint;
    currency: string;
    id: string;
    reservedBalanceMinor: bigint;
    status: WalletStatus;
    updatedAt: Date;
    version: number;
  }) {
    return {
      availableBalanceMinor: wallet.availableBalanceMinor.toString(),
      currency: wallet.currency,
      id: wallet.id,
      reservedBalanceMinor: wallet.reservedBalanceMinor.toString(),
      status: wallet.status,
      updatedAt: wallet.updatedAt.toISOString(),
      version: wallet.version,
    };
  }

  private reservationDto(reservation: {
    amountMinor: bigint;
    capturedMinor: bigint;
    currency: string;
    id: string;
    releasedMinor: bigint;
    status: WalletReservationStatus;
  }) {
    return {
      amountMinor: reservation.amountMinor.toString(),
      capturedMinor: reservation.capturedMinor.toString(),
      currency: reservation.currency,
      id: reservation.id,
      releasedMinor: reservation.releasedMinor.toString(),
      status: reservation.status,
    };
  }

  private async serializableTransaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.repository.client().$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' &&
              typeof error.meta?.code === 'string' &&
              error.meta.code === '40001'));
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw new ConflictException({
      code: 'FINANCIAL_CONCURRENCY_CONFLICT',
      message: 'Operacao financeira concorrente nao pode ser concluida.',
    });
  }

  private async recordWalletEvent(
    client: Prisma.TransactionClient,
    user: AuthUser,
    walletId: string,
    action: string,
    eventType: string,
    money: Money,
    correlationId: string,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        action,
        after: {
          amountMinor: money.amountMinor.toString(),
          currency: money.currency,
        },
        correlationId,
        entityId: walletId,
        entityType: 'Wallet',
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    await this.outbox.publish(
      {
        aggregateId: walletId,
        aggregateType: 'Wallet',
        eventType,
        payload: {
          amountMinor: money.amountMinor.toString(),
          currency: money.currency,
        },
        tenantId: user.tenantId,
      },
      client,
    );
  }

  private decodeCursor(value: string): { createdAt: Date; id: string } {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as { createdAt?: string; id?: string };
      if (!parsed.createdAt || !parsed.id) throw new Error('Invalid cursor');
      const createdAt = new Date(parsed.createdAt);
      if (Number.isNaN(createdAt.getTime())) throw new Error('Invalid cursor');
      return { createdAt, id: parsed.id };
    } catch {
      throw new ConflictException('Cursor financeiro invalido.');
    }
  }

  private userDirection(type: LedgerTransactionType): 'CREDIT' | 'DEBIT' {
    switch (type) {
      case LedgerTransactionType.TOP_UP:
      case LedgerTransactionType.REFUND:
      case LedgerTransactionType.RELEASE:
      case LedgerTransactionType.AUTO_RECHARGE:
      case LedgerTransactionType.ADJUSTMENT:
      case LedgerTransactionType.REVERSAL:
        return 'CREDIT';
      case LedgerTransactionType.AUTHORIZATION:
      case LedgerTransactionType.CAPTURE:
        return 'DEBIT';
    }
  }
}
