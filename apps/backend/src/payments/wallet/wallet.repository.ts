import { Injectable } from '@nestjs/common';
import { Prisma, type Wallet } from '@solis/database';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  client(): PrismaService {
    return this.prisma;
  }

  findOwned(
    tenantId: string, userId: string, currency: string,
  ): Prisma.PrismaPromise<Wallet | null> {
    return this.prisma.wallet.findFirst({
      where: { currency, deletedAt: null, tenantId, userId },
    });
  }

  async lockOwned(
    client: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    currency: string,
  ): Promise<Wallet | null> {
    const wallets = await client.$queryRaw<Wallet[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        user_id AS "userId",
        currency,
        available_balance_minor AS "availableBalanceMinor",
        reserved_balance_minor AS "reservedBalanceMinor",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt",
        version
      FROM wallets
      WHERE tenant_id = ${tenantId}::uuid
        AND user_id = ${userId}::uuid
        AND currency = ${currency}
        AND deleted_at IS NULL
      FOR UPDATE
    `);
    return wallets[0] ?? null;
  }

  async lockReservation(
    client: Prisma.TransactionClient,
    reservationId: string,
    walletId: string,
  ) {
    const rows = await client.$queryRaw<
      Array<{
        amountMinor: bigint;
        capturedMinor: bigint;
        chargingSessionId: string | null;
        id: string;
        paymentIntentId: string | null;
        releasedMinor: bigint;
        status: string;
      }>
    >(Prisma.sql`
      SELECT
        id,
        amount_minor AS "amountMinor",
        captured_minor AS "capturedMinor",
        charging_session_id AS "chargingSessionId",
        payment_intent_id AS "paymentIntentId",
        released_minor AS "releasedMinor",
        status::text AS status
      FROM wallet_reservations
      WHERE id = ${reservationId}::uuid AND wallet_id = ${walletId}::uuid
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }
}
