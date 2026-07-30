import { Injectable } from '@nestjs/common';
import {
  type LedgerAccount,
  LedgerAccountOwnerType,
  LedgerAccountStatus,
  type LedgerAccountType,
  Prisma,
} from '@solis/database';

import { PrismaService } from '../../database/prisma.service';

export type FinancialClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  client(): PrismaService {
    return this.prisma;
  }

  findTransaction(
    client: FinancialClient,
    tenantId: string,
    idempotencyKey: string,
  ): Prisma.PrismaPromise<
    Prisma.LedgerTransactionGetPayload<{ include: { entries: true } }> | null
  > {
    return client.ledgerTransaction.findUnique({
      include: { entries: true },
      where: { tenantId_idempotencyKey: { idempotencyKey, tenantId } },
    });
  }

  findTransactionById(
    client: FinancialClient,
    tenantId: string,
    id: string,
  ): Prisma.PrismaPromise<
    Prisma.LedgerTransactionGetPayload<{
      include: { entries: { include: { account: true } } };
    }> | null
  > {
    return client.ledgerTransaction.findFirst({
      include: { entries: { include: { account: true } } },
      where: { id, tenantId },
    });
  }

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
    const ownerType = input.ownerType ?? LedgerAccountOwnerType.USER;
    return client.ledgerAccount.upsert({
      create: {
        accountType: input.accountType,
        currency: input.currency,
        ownerId: input.ownerId,
        ownerType,
        status: LedgerAccountStatus.ACTIVE,
        tenantId: input.tenantId,
      },
      update: {},
      where: {
        tenantId_ownerType_ownerId_accountType_currency: {
          accountType: input.accountType,
          currency: input.currency,
          ownerId: input.ownerId,
          ownerType,
          tenantId: input.tenantId,
        },
      },
    });
  }
}
