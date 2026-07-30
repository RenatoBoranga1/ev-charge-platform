import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentIntentStatus,
  PaymentIntentType,
  Prisma,
  type PaymentIntent,
} from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { DomainEventPublisher } from '../../outbox/domain-event-publisher';
import { financialRequestHash } from '../financial-request-hash';
import type { Money } from '../money';
import {
  assertPaymentIntentTransition,
  isTerminalPaymentIntentStatus,
} from './payment-intent-state-machine';

export interface CreatePaymentIntent {
  chargingSessionId?: string;
  expiresAt?: Date;
  idempotencyKey: string;
  metadata?: Record<string, string | boolean | null>;
  money: Money;
  provider: string;
  providerReference?: string;
  type: PaymentIntentType;
}

export interface PaymentIntentDto {
  amountMinor: string;
  authorizedAmountMinor: string;
  capturedAmountMinor: string;
  createdAt: string;
  currency: string;
  expiresAt: string | null;
  id: string;
  isTerminal: boolean;
  metadata: Prisma.JsonValue;
  refundedAmountMinor: string;
  status: PaymentIntentStatus;
  type: PaymentIntentType;
  updatedAt: string;
}

@Injectable()
export class PaymentIntentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async create(
    input: CreatePaymentIntent,
    user: AuthUser,
    client?: Prisma.TransactionClient,
  ): Promise<PaymentIntent> {
    const database = client ?? this.prisma;
    const requestHash = financialRequestHash({
      amountMinor: input.money.amountMinor,
      chargingSessionId: input.chargingSessionId ?? null,
      currency: input.money.currency,
      provider: input.provider,
      type: input.type,
    });
    const existing = await database.paymentIntent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          idempotencyKey: input.idempotencyKey,
          tenantId: user.tenantId,
        },
      },
    });
    if (existing) {
      if (existing.requestHash !== requestHash || existing.userId !== user.sub) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          message: 'Idempotency-Key reutilizada com outro pagamento.',
        });
      }
      return existing;
    }

    try {
      const created = await database.paymentIntent.create({
        data: {
          amountMinor: input.money.amountMinor,
          chargingSessionId: input.chargingSessionId,
          currency: input.money.currency,
          expiresAt: input.expiresAt,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata,
          provider: input.provider,
          providerReference: input.providerReference,
          requestHash,
          status: PaymentIntentStatus.CREATED,
          tenantId: user.tenantId,
          type: input.type,
          userId: user.sub,
        },
      });
      await database.auditLog.create({
        data: {
          action: 'PAYMENT_INTENT_CREATED',
          after: { status: created.status, type: created.type },
          entityId: created.id,
          entityType: 'PaymentIntent',
          tenantId: user.tenantId,
          userId: user.sub,
        },
      });
      await this.outbox.publish(
        {
          aggregateId: created.id,
          aggregateType: 'PaymentIntent',
          eventType: 'PaymentIntentCreated',
          payload: { status: created.status, type: created.type },
          tenantId: user.tenantId,
        },
        client,
      );
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await database.paymentIntent.findUniqueOrThrow({
          where: {
            tenantId_idempotencyKey: {
              idempotencyKey: input.idempotencyKey,
              tenantId: user.tenantId,
            },
          },
        });
        if (raced.requestHash === requestHash && raced.userId === user.sub) {
          return raced;
        }
      }
      throw error;
    }
  }

  async transition(
    intentId: string,
    target: PaymentIntentStatus,
    user: AuthUser,
    data: {
      authorizedAmountMinor?: bigint;
      capturedAmountMinor?: bigint;
      expiresAt?: Date;
      metadata?: Record<string, string | boolean | null>;
      providerReference?: string;
      refundedAmountMinor?: bigint;
    } = {},
    client?: Prisma.TransactionClient,
  ): Promise<PaymentIntent> {
    const database = client ?? this.prisma;
    const current = await database.paymentIntent.findFirst({
      where: {
        deletedAt: null,
        id: intentId,
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    if (!current) throw new NotFoundException('Pagamento nao encontrado.');
    assertPaymentIntentTransition(current.status, target);
    if (current.status === target) return current;
    const update = await database.paymentIntent.updateMany({
      data: {
        ...data,
        metadata: data.metadata,
        status: target,
        version: { increment: 1 },
      },
      where: { id: current.id, status: current.status, version: current.version },
    });
    if (update.count !== 1) {
      const raced = await database.paymentIntent.findUnique({
        where: { id: current.id },
      });
      if (raced?.status === target) {
        return raced;
      }
      throw new ConflictException({
        code: 'OPTIMISTIC_LOCK_CONFLICT',
        message: 'Pagamento alterado por outra operacao.',
      });
    }
    const updated = await database.paymentIntent.findUniqueOrThrow({
      where: { id: current.id },
    });
    await database.auditLog.create({
      data: {
        action: 'PAYMENT_INTENT_STATE_CHANGED',
        after: { status: updated.status, version: updated.version },
        before: { status: current.status, version: current.version },
        entityId: updated.id,
        entityType: 'PaymentIntent',
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    await this.outbox.publish(
      {
        aggregateId: updated.id,
        aggregateType: 'PaymentIntent',
        eventType: `Payment${target}`,
        payload: { from: current.status, to: target, version: updated.version },
        tenantId: user.tenantId,
      },
      client,
    );
    return updated;
  }

  async get(intentId: string, user: AuthUser): Promise<PaymentIntentDto> {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { deletedAt: null, id: intentId, tenantId: user.tenantId, userId: user.sub },
    });
    if (!intent) throw new NotFoundException('Pagamento nao encontrado.');
    return this.toDto(intent);
  }

  async list(user: AuthUser): Promise<PaymentIntentDto[]> {
    const intents = await this.prisma.paymentIntent.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      where: { deletedAt: null, tenantId: user.tenantId, userId: user.sub },
    });
    return intents.map((intent) => this.toDto(intent));
  }

  async findByProviderReference(provider: string, providerReference: string) {
    return this.prisma.paymentIntent.findFirst({
      where: { deletedAt: null, provider, providerReference },
    });
  }

  toDto(intent: PaymentIntent): PaymentIntentDto {
    return {
      amountMinor: intent.amountMinor.toString(),
      authorizedAmountMinor: intent.authorizedAmountMinor.toString(),
      capturedAmountMinor: intent.capturedAmountMinor.toString(),
      createdAt: intent.createdAt.toISOString(),
      currency: intent.currency,
      expiresAt: intent.expiresAt?.toISOString() ?? null,
      id: intent.id,
      isTerminal: isTerminalPaymentIntentStatus(intent.status),
      metadata: intent.metadata,
      refundedAmountMinor: intent.refundedAmountMinor.toString(),
      status: intent.status,
      type: intent.type,
      updatedAt: intent.updatedAt.toISOString(),
    };
  }
}
