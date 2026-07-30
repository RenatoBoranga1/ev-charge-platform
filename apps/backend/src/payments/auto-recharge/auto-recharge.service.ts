import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  LedgerTransactionType,
  PaymentIntentStatus,
  PaymentIntentType,
  PaymentMethodStatus,
  Prisma,
  type AutoRechargeRule,
} from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DomainEventPublisher } from '../../outbox/domain-event-publisher';
import { PaymentGateway } from '../gateway/payment.gateway';
import { PaymentIntentService } from '../intents/payment-intent.service';
import { Money } from '../money';
import { WalletService } from '../wallet/wallet.service';
import type { UpdateAutoRechargeDto } from './dto/update-auto-recharge.dto';

@Injectable()
export class AutoRechargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: PaymentGateway,
    private readonly intents: PaymentIntentService,
    private readonly wallet: WalletService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async get(user: AuthUser) {
    const rule = await this.prisma.autoRechargeRule.findUnique({
      where: {
        tenantId_userId_currency: {
          currency: 'BRL',
          tenantId: user.tenantId,
          userId: user.sub,
        },
      },
    });
    return rule ? this.toDto(rule) : this.disabledDto();
  }

  async update(
    input: UpdateAutoRechargeDto,
    user: AuthUser,
    correlationId: string,
  ) {
    if (input.enabled && !input.consentConfirmed) {
      throw new ConflictException({
        code: 'AUTO_RECHARGE_CONSENT_REQUIRED',
        message: 'Confirme o consentimento para ativar a recarga automatica.',
      });
    }
    const minimum = Money.fromMinorUnits(input.minimumBalanceMinor, input.currency);
    const recharge = Money.fromMinorUnits(input.rechargeAmountMinor, input.currency);
    if (recharge.isZero()) {
      throw new ConflictException('O valor de recarga deve ser maior que zero.');
    }
    const method = await this.prisma.paymentMethod.findFirst({
      where: {
        deletedAt: null,
        id: input.paymentMethodId,
        status: PaymentMethodStatus.ACTIVE,
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    if (!method) throw new NotFoundException('Metodo de pagamento ativo nao encontrado.');

    const rule = await this.prisma.$transaction(async (client) => {
      const saved = await client.autoRechargeRule.upsert({
        create: {
          currency: input.currency,
          enabled: input.enabled,
          minimumBalanceMinor: minimum.amountMinor,
          paymentMethodId: method.id,
          rechargeAmountMinor: recharge.amountMinor,
          tenantId: user.tenantId,
          userId: user.sub,
        },
        update: {
          cooldownUntil: null,
          enabled: input.enabled,
          failureCount: 0,
          minimumBalanceMinor: minimum.amountMinor,
          paymentMethodId: method.id,
          rechargeAmountMinor: recharge.amountMinor,
          version: { increment: 1 },
        },
        where: {
          tenantId_userId_currency: {
            currency: input.currency,
            tenantId: user.tenantId,
            userId: user.sub,
          },
        },
      });
      await this.audit(client, user, correlationId, saved, 'AUTO_RECHARGE_UPDATED');
      return saved;
    });
    return this.toDto(rule);
  }

  async disable(user: AuthUser, correlationId: string) {
    const rule = await this.prisma.autoRechargeRule.findUnique({
      where: {
        tenantId_userId_currency: {
          currency: 'BRL',
          tenantId: user.tenantId,
          userId: user.sub,
        },
      },
    });
    if (!rule) return this.disabledDto();
    const disabled = await this.prisma.$transaction(async (client) => {
      const saved = await client.autoRechargeRule.update({
        data: { enabled: false, version: { increment: 1 } },
        where: { id: rule.id },
      });
      await this.audit(client, user, correlationId, saved, 'AUTO_RECHARGE_DISABLED');
      return saved;
    });
    return this.toDto(disabled);
  }

  async evaluate(user: AuthUser, correlationId: string) {
    const lockKey = `payments:auto-recharge:${user.tenantId}:${user.sub}`;
    const lockValue = randomUUID();
    const acquired = await this.redis.client.set(lockKey, lockValue, 'PX', 60_000, 'NX');
    if (acquired !== 'OK') return { triggered: false, reason: 'LOCKED' as const };
    try {
      const rule = await this.prisma.autoRechargeRule.findUnique({
        include: { paymentMethod: true },
        where: {
          tenantId_userId_currency: {
            currency: 'BRL',
            tenantId: user.tenantId,
            userId: user.sub,
          },
        },
      });
      if (!rule?.enabled) return { triggered: false, reason: 'DISABLED' as const };
      if (rule.cooldownUntil && rule.cooldownUntil > new Date()) {
        return { triggered: false, reason: 'COOLDOWN' as const };
      }
      if (
        !rule.paymentMethod ||
        rule.paymentMethod.status !== PaymentMethodStatus.ACTIVE
      ) {
        await this.failRule(rule, 'Metodo de pagamento invalido.');
        return { triggered: false, reason: 'INVALID_METHOD' as const };
      }
      const balance = await this.wallet.get(user, rule.currency);
      if (BigInt(balance.availableBalanceMinor) >= rule.minimumBalanceMinor) {
        return { triggered: false, reason: 'ABOVE_MINIMUM' as const };
      }

      const money = Money.fromMinorUnits(rule.rechargeAmountMinor, rule.currency);
      const bucket = new Date().toISOString().slice(0, 13);
      const idempotencyKey = `auto:${rule.id}:${bucket}`;
      let intent = await this.intents.create(
        {
          idempotencyKey,
          money,
          provider: this.gateway.provider,
          type: PaymentIntentType.AUTO_RECHARGE,
        },
        user,
      );
      if (intent.status === PaymentIntentStatus.CAPTURED) {
        return { paymentId: intent.id, triggered: true };
      }
      if (intent.status === PaymentIntentStatus.CREATED) {
        intent = await this.intents.transition(
          intent.id,
          PaymentIntentStatus.PENDING,
          user,
        );
      }
      let result;
      try {
        result = await this.gateway.createCardAuthorization({
          idempotencyKey,
          money,
          paymentMethodToken: rule.paymentMethod.providerToken,
        });
      } catch {
        await this.intents.transition(
          intent.id,
          PaymentIntentStatus.REQUIRES_REVIEW,
          user,
          {
            metadata: {
              reason: 'PROVIDER_RESULT_UNKNOWN',
            },
          },
        );
        await this.failRule(rule, 'Resultado do gateway desconhecido.');
        return { triggered: false, reason: 'REQUIRES_REVIEW' as const };
      }
      if (result.status !== 'APPROVED') {
        await this.intents.transition(
          intent.id,
          result.status === 'REQUIRES_REVIEW'
            ? PaymentIntentStatus.REQUIRES_REVIEW
            : PaymentIntentStatus.FAILED,
          user,
          { providerReference: result.providerReference },
        );
        await this.failRule(rule, 'Gateway recusou a recarga automatica.');
        return { triggered: false, reason: 'FAILED' as const };
      }
      await this.wallet.credit({
        correlationId,
        idempotencyKey,
        ledgerType: LedgerTransactionType.AUTO_RECHARGE,
        money,
        user,
      });
      intent = await this.intents.transition(
        intent.id,
        PaymentIntentStatus.CAPTURED,
        user,
        {
          capturedAmountMinor: money.amountMinor,
          providerReference: result.providerReference,
        },
      );
      await this.prisma.autoRechargeRule.update({
        data: {
          failureCount: 0,
          lastTriggeredAt: new Date(),
          version: { increment: 1 },
        },
        where: { id: rule.id },
      });
      return { paymentId: intent.id, triggered: true };
    } finally {
      await this.redis.client.eval(
        "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        1,
        lockKey,
        lockValue,
      );
    }
  }

  private async failRule(rule: AutoRechargeRule, reason: string): Promise<void> {
    const failureCount = rule.failureCount + 1;
    await this.prisma.$transaction(async (client) => {
      await client.autoRechargeRule.update({
        data: {
          cooldownUntil: new Date(Date.now() + 60 * 60 * 1000),
          enabled: failureCount < 3,
          failureCount,
          lastFailureAt: new Date(),
          version: { increment: 1 },
        },
        where: { id: rule.id },
      });
      await this.outbox.publish(
        {
          aggregateId: rule.id,
          aggregateType: 'AutoRechargeRule',
          eventType: 'AutoRechargeFailed',
          payload: { failureCount, reason },
          tenantId: rule.tenantId,
        },
        client,
      );
    });
  }

  private async audit(
    client: Prisma.TransactionClient,
    user: AuthUser,
    correlationId: string,
    rule: AutoRechargeRule,
    action: string,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        action,
        after: { enabled: rule.enabled, version: rule.version },
        correlationId,
        entityId: rule.id,
        entityType: 'AutoRechargeRule',
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
  }

  private toDto(rule: AutoRechargeRule) {
    return {
      cooldownUntil: rule.cooldownUntil?.toISOString() ?? null,
      currency: rule.currency,
      enabled: rule.enabled,
      failureCount: rule.failureCount,
      id: rule.id,
      minimumBalanceMinor: rule.minimumBalanceMinor.toString(),
      paymentMethodId: rule.paymentMethodId,
      rechargeAmountMinor: rule.rechargeAmountMinor.toString(),
    };
  }

  private disabledDto() {
    return {
      cooldownUntil: null,
      currency: 'BRL',
      enabled: false,
      failureCount: 0,
      id: null,
      minimumBalanceMinor: '0',
      paymentMethodId: null,
      rechargeAmountMinor: '0',
    };
  }
}
