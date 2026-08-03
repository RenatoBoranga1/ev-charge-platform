import { Injectable } from '@nestjs/common';
import {
  PaymentIntentStatus,
  PaymentReconciliationStatus,
} from '@solis/database';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PaymentGateway } from '../gateway/payment.gateway';

@Injectable()
export class PaymentReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: PaymentGateway,
  ) {}

  async run(tenantId?: string): Promise<{
    locked: boolean;
    processed: number;
    mismatches: number;
  }> {
    const lockKey = tenantId
      ? 'payments:reconciliation:' + tenantId
      : 'payments:reconciliation:global';
    const lockValue = randomUUID();
    const acquired = await this.redis.client.set(
      lockKey,
      lockValue,
      'PX',
      5 * 60_000,
      'NX',
    );
    if (acquired !== 'OK') {
      return { locked: true, mismatches: 0, processed: 0 };
    }
    try {
      const intents = await this.prisma.paymentIntent.findMany({
        orderBy: { updatedAt: 'asc' },
        take: 500,
        where: {
          deletedAt: null,
          provider: this.gateway.provider,
          ...(tenantId ? { tenantId } : {}),
          status: {
            in: [
              PaymentIntentStatus.PENDING,
              PaymentIntentStatus.PROCESSING,
              PaymentIntentStatus.AUTHORIZED,
              PaymentIntentStatus.REQUIRES_REVIEW,
            ],
          },
        },
      });
      let mismatches = 0;
      for (const intent of intents) {
        const status = await this.reconcile(intent);
        if (status !== PaymentReconciliationStatus.MATCHED) mismatches += 1;
      }
      return { locked: false, mismatches, processed: intents.length };
    } finally {
      await this.redis.client.eval(
        "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        1,
        lockKey,
        lockValue,
      );
    }
  }

  private async reconcile(intent: {
    amountMinor: bigint;
    currency: string;
    id: string;
    providerReference: string | null;
    status: PaymentIntentStatus;
    tenantId: string;
  }): Promise<PaymentReconciliationStatus> {
    let status: PaymentReconciliationStatus;
    let providerAmountMinor: bigint | null = null;
    let providerStatus: string | null = null;
    if (!intent.providerReference) {
      status = PaymentReconciliationStatus.MISSING_AT_PROVIDER;
    } else {
      try {
        const remote = await this.gateway.getPaymentStatus(
          intent.providerReference,
        );
        providerStatus = remote.status;
        providerAmountMinor =
          remote.amountMinor === undefined ? null : BigInt(remote.amountMinor);
        if (
          providerAmountMinor !== null &&
          (providerAmountMinor !== intent.amountMinor ||
            remote.currency !== intent.currency)
        ) {
          status = PaymentReconciliationStatus.AMOUNT_MISMATCH;
        } else if (this.statusMatches(intent.status, remote.status)) {
          status = PaymentReconciliationStatus.MATCHED;
        } else {
          status = PaymentReconciliationStatus.STATUS_MISMATCH;
        }
      } catch {
        status = PaymentReconciliationStatus.MISSING_AT_PROVIDER;
      }
    }
    await this.prisma.paymentReconciliation.create({
      data: {
        details:
          status === PaymentReconciliationStatus.MATCHED
            ? undefined
            : {
                action: 'MANUAL_REVIEW_REQUIRED',
                reason: status,
              },
        localAmountMinor: intent.amountMinor,
        localStatus: intent.status,
        paymentIntentId: intent.id,
        providerAmountMinor,
        providerStatus,
        status,
        tenantId: intent.tenantId,
      },
    });
    return status;
  }

  private statusMatches(
    local: PaymentIntentStatus,
    remote: string,
  ): boolean {
    const expected: Partial<Record<PaymentIntentStatus, string>> = {
      [PaymentIntentStatus.AUTHORIZED]: 'APPROVED',
      [PaymentIntentStatus.CAPTURED]: 'APPROVED',
      [PaymentIntentStatus.CANCELLED]: 'CANCELLED',
      [PaymentIntentStatus.EXPIRED]: 'EXPIRED',
      [PaymentIntentStatus.FAILED]: 'DECLINED',
      [PaymentIntentStatus.PENDING]: 'PENDING',
      [PaymentIntentStatus.REFUNDED]: 'REFUNDED',
    };
    return expected[local] === remote;
  }
}
