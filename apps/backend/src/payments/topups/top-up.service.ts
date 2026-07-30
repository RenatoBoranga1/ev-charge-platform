import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentIntentStatus,
  PaymentIntentType,
  type PaymentIntent,
} from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { environment } from '../../config/environment';
import { PrismaService } from '../../database/prisma.service';
import { Money } from '../money';
import { PaymentGateway, type PaymentWebhook } from '../gateway/payment.gateway';
import { PaymentIntentService } from '../intents/payment-intent.service';
import { WalletService } from '../wallet/wallet.service';
import type { CreateTopUpDto } from './dto/create-top-up.dto';

@Injectable()
export class TopUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intents: PaymentIntentService,
    private readonly gateway: PaymentGateway,
    private readonly wallet: WalletService,
  ) {}

  async create(
    input: CreateTopUpDto, user: AuthUser,
  ): Promise<ReturnType<PaymentIntentService['toDto']>> {
    this.assertMockEnabled();
    const money = Money.fromMinorUnits(input.amountMinor, input.currency, {
      maximumAmountMinor: environment.maximumMoneyMinor,
    });
    const policy = await this.paymentPolicy(user.tenantId, money.currency);
    if (
      money.amountMinor < policy.minimumTopUpAmountMinor ||
      money.amountMinor > policy.maximumTopUpAmountMinor
    ) {
      throw new ConflictException({
        code: 'TOP_UP_AMOUNT_OUT_OF_RANGE',
        message: 'Valor fora dos limites configurados para recarga da carteira.',
      });
    }
    await this.wallet.get(user, money.currency);
    const idempotencyKey = `topup:${user.sub}:${input.idempotencyKey}`;
    let intent = await this.intents.create(
      {
        idempotencyKey,
        money,
        provider: this.gateway.provider,
        type: PaymentIntentType.WALLET_TOP_UP,
      },
      user,
    );
    if (intent.status !== PaymentIntentStatus.CREATED) {
      return this.toTopUpDto(intent);
    }

    const pix = await this.gateway.createPixCharge({
      idempotencyKey,
      money,
      scenario: input.scenario,
    });
    intent = await this.intents.transition(
      intent.id,
      PaymentIntentStatus.PENDING,
      user,
      {
        expiresAt: pix.expiresAt,
        metadata: {
          copyPasteCode: pix.copyPasteCode,
          qrPayload: pix.qrPayload,
          scenario: input.scenario ?? 'approved',
        },
        providerReference: pix.providerReference,
      },
    );
    if (pix.status === 'DECLINED') {
      intent = await this.intents.transition(
        intent.id,
        PaymentIntentStatus.FAILED,
        user,
      );
    } else if (pix.status === 'EXPIRED') {
      intent = await this.intents.transition(
        intent.id,
        PaymentIntentStatus.EXPIRED,
        user,
      );
    } else if (pix.status === 'REQUIRES_REVIEW') {
      intent = await this.intents.transition(
        intent.id,
        PaymentIntentStatus.REQUIRES_REVIEW,
        user,
      );
    }
    return this.toTopUpDto(intent);
  }

  async get(intentId: string, user: AuthUser): Promise<ReturnType<PaymentIntentService['toDto']>> {
    return this.toTopUpDto(await this.ownedTopUp(intentId, user));
  }

  async cancel(intentId: string, user: AuthUser): Promise<ReturnType<PaymentIntentService['toDto']>> {
    const intent = await this.ownedTopUp(intentId, user);
    if (intent.status === PaymentIntentStatus.CANCELLED) {
      return this.toTopUpDto(intent);
    }
    if (
      intent.status !== PaymentIntentStatus.PENDING &&
      intent.status !== PaymentIntentStatus.REQUIRES_ACTION
    ) {
      throw new ConflictException('Este top-up nao pode ser cancelado.');
    }
    if (!intent.providerReference) {
      throw new ConflictException('Top-up sem referencia no gateway.');
    }
    await this.gateway.cancelPixCharge(intent.providerReference);
    return this.toTopUpDto(
      await this.intents.transition(
        intent.id,
        PaymentIntentStatus.CANCELLED,
        user,
      ),
    );
  }

  async applyWebhook(
    webhook: PaymentWebhook,
    correlationId: string,
  ): Promise<PaymentIntent> {
    const intent = await this.intents.findByProviderReference(
      this.gateway.provider,
      webhook.providerReference,
    );
    if (!intent) throw new NotFoundException('Pagamento do webhook nao encontrado.');
    if (
      intent.amountMinor.toString() !== webhook.amountMinor ||
      intent.currency !== webhook.currency
    ) {
      return this.markReview(intent, 'Webhook amount or currency mismatch.');
    }
    const user = this.systemUser(intent);
    if (webhook.status === 'APPROVED') {
      if (intent.status === PaymentIntentStatus.CAPTURED) return intent;
      if (
        intent.status === PaymentIntentStatus.CANCELLED ||
        intent.status === PaymentIntentStatus.EXPIRED
      ) {
        return this.markReview(intent, 'Approved event arrived after terminal state.');
      }
      await this.wallet.credit({
        correlationId,
        idempotencyKey: `topup-webhook:${intent.id}`,
        money: Money.fromMinorUnits(intent.amountMinor, intent.currency),
        paymentIntentId: intent.id,
        user,
      });
      return this.intents.transition(
        intent.id,
        PaymentIntentStatus.CAPTURED,
        user,
        { capturedAmountMinor: intent.amountMinor },
      );
    }
    if (webhook.status === 'DECLINED') {
      return this.intents.transition(
        intent.id,
        PaymentIntentStatus.FAILED,
        user,
      );
    }
    if (webhook.status === 'EXPIRED') {
      return this.intents.transition(
        intent.id,
        PaymentIntentStatus.EXPIRED,
        user,
      );
    }
    if (webhook.status === 'REQUIRES_REVIEW') {
      return this.markReview(intent, 'Unknown provider status.');
    }
    return intent;
  }

  private async ownedTopUp(intentId: string, user: AuthUser) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        deletedAt: null,
        id: intentId,
        tenantId: user.tenantId,
        type: PaymentIntentType.WALLET_TOP_UP,
        userId: user.sub,
      },
    });
    if (!intent) throw new NotFoundException('Top-up nao encontrado.');
    return intent;
  }

  private async paymentPolicy(tenantId: string, currency: string) {
    const policy = await this.prisma.paymentPolicyConfig.findUnique({
      where: { tenantId_currency: { currency, tenantId } },
    });
    if (policy) return policy;
    if (environment.paymentsMode !== 'mock') {
      throw new ConflictException('Configuracao financeira do tenant ausente.');
    }
    return {
      maximumTopUpAmountMinor: 200_000n,
      minimumTopUpAmountMinor: 5_000n,
    };
  }

  private markReview(intent: PaymentIntent, reason: string) {
    return this.prisma.paymentIntent.update({
      data: {
        metadata: { reviewReason: reason },
        status: PaymentIntentStatus.REQUIRES_REVIEW,
        version: { increment: 1 },
      },
      where: { id: intent.id },
    });
  }

  private systemUser(intent: PaymentIntent): AuthUser {
    return {
      email: 'payments@internal.solis',
      role: 'SYSTEM',
      sub: intent.userId,
      tenantId: intent.tenantId,
    };
  }

  private toTopUpDto(intent: PaymentIntent) {
    return this.intents.toDto(intent);
  }

  private assertMockEnabled(): void {
    if (environment.paymentsMode !== 'mock') {
      throw new ConflictException({
        code: 'PAYMENTS_MODE_UNAVAILABLE',
        message: `Top-up indisponivel em PAYMENTS_MODE=${environment.paymentsMode}.`,
      });
    }
  }
}
