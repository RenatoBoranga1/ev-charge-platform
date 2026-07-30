import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentIntentStatus,
  Prisma,
  ReceiptStatus,
  RefundStatus,
} from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { DomainEventPublisher } from '../../outbox/domain-event-publisher';
import { financialRequestHash } from '../financial-request-hash';
import { Money } from '../money';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async refundCapturedPayment(
    paymentIntentId: string,
    user: AuthUser,
    idempotencyKey: string,
    reason: string,
    correlationId: string,
  ) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        deletedAt: null,
        id: paymentIntentId,
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    if (!intent) throw new NotFoundException('Pagamento nao encontrado.');
    if (
      intent.status !== PaymentIntentStatus.CAPTURED &&
      intent.status !== PaymentIntentStatus.PARTIALLY_REFUNDED &&
      intent.status !== PaymentIntentStatus.REFUNDED
    ) {
      throw new ConflictException('Somente um pagamento capturado pode ser estornado.');
    }
    const amountMinor =
      intent.capturedAmountMinor - intent.refundedAmountMinor;
    if (amountMinor <= 0n || intent.status === PaymentIntentStatus.REFUNDED) {
      const existing = await this.prisma.refund.findFirst({
        where: { idempotencyKey, paymentIntentId },
      });
      if (!existing) throw new ConflictException('Pagamento ja estornado.');
      const replayHash = financialRequestHash({
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        paymentIntentId,
        reason,
      });
      if (existing.requestHash !== replayHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          message: 'Chave de estorno reutilizada com outro payload.',
        });
      }
      return this.toDto(existing);
    }
    const requestHash = financialRequestHash({
      amountMinor,
      currency: intent.currency,
      paymentIntentId,
      reason,
    });
    let refund;
    try {
      refund = await this.prisma.refund.create({
        data: {
          amountMinor,
          currency: intent.currency,
          idempotencyKey,
          paymentIntentId,
          reason: reason.slice(0, 240),
          requestHash,
          status: RefundStatus.PROCESSING,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.refund.findUniqueOrThrow({
          where: {
            paymentIntentId_idempotencyKey: {
              idempotencyKey,
              paymentIntentId,
            },
          },
        });
        if (existing.requestHash !== requestHash) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
            message: 'Chave de estorno reutilizada com outro payload.',
          });
        }
        if (existing.status === RefundStatus.COMPLETED) {
          return this.toDto(existing);
        }
        refund = existing;
      } else {
        throw error;
      }
    }

    const money = Money.fromMinorUnits(amountMinor, intent.currency);
    await this.wallet.refund({
      correlationId,
      idempotencyKey: `refund:${refund.id}`,
      money,
      user,
    });
    const completed = await this.prisma.$transaction(async (client) => {
      const claim = await client.refund.updateMany({
        data: {
          completedAt: new Date(),
          status: RefundStatus.COMPLETED,
        },
        where: { id: refund.id, status: RefundStatus.PROCESSING },
      });
      if (claim.count === 0) {
        return client.refund.findUniqueOrThrow({
          where: { id: refund.id },
        });
      }
      const latest = await client.paymentIntent.findUniqueOrThrow({
        where: { id: intent.id },
      });
      const refundedAmountMinor = latest.refundedAmountMinor + amountMinor;
      if (refundedAmountMinor > latest.capturedAmountMinor) {
        throw new ConflictException({
          code: 'REFUND_EXCEEDS_CAPTURE',
          message: 'Estorno superior ao valor capturado.',
        });
      }
      const full = refundedAmountMinor === latest.capturedAmountMinor;
      await client.paymentIntent.update({
        data: {
          refundedAmountMinor,
          status: full
            ? PaymentIntentStatus.REFUNDED
            : PaymentIntentStatus.PARTIALLY_REFUNDED,
          version: { increment: 1 },
        },
        where: { id: latest.id },
      });
      const saved = await client.refund.findUniqueOrThrow({
        where: { id: refund.id },
      });
      await client.receipt.updateMany({
        data: {
          status: full
            ? ReceiptStatus.REFUNDED
            : ReceiptStatus.PARTIALLY_REFUNDED,
        },
        where: { paymentIntentId },
      });
      await client.auditLog.create({
        data: {
          action: 'PAYMENT_REFUNDED',
          after: {
            amountMinor: amountMinor.toString(),
            currency: intent.currency,
            status: saved.status,
          },
          correlationId,
          entityId: saved.id,
          entityType: 'Refund',
          tenantId: user.tenantId,
          userId: user.sub,
        },
      });
      await this.outbox.publish(
        {
          aggregateId: saved.id,
          aggregateType: 'Refund',
          eventType: 'RefundCompleted',
          payload: {
            amountMinor: amountMinor.toString(),
            currency: intent.currency,
            paymentIntentId,
          },
          tenantId: user.tenantId,
        },
        client,
      );
      return saved;
    });
    return this.toDto(completed);
  }

  private toDto(refund: {
    amountMinor: bigint;
    completedAt: Date | null;
    currency: string;
    id: string;
    paymentIntentId: string;
    reason: string;
    status: RefundStatus;
  }) {
    return {
      amountMinor: refund.amountMinor.toString(),
      completedAt: refund.completedAt?.toISOString() ?? null,
      currency: refund.currency,
      id: refund.id,
      paymentIntentId: refund.paymentIntentId,
      reason: refund.reason,
      status: refund.status,
    };
  }
}
