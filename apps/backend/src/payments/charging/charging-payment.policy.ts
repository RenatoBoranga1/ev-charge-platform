import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentIntentStatus,
  PaymentIntentType,
  WalletReservationStatus,
} from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { environment } from '../../config/environment';
import { PrismaService } from '../../database/prisma.service';
import { AutoRechargeService } from '../auto-recharge/auto-recharge.service';
import { PaymentIntentService } from '../intents/payment-intent.service';
import { Money } from '../money';
import { type ReceiptDto, ReceiptService } from '../receipts/receipt.service';
import { WalletService } from '../wallet/wallet.service';

export interface ChargingFinancialContext {
  chargingSessionId: string;
  currency: string;
}

@Injectable()
export class ChargingPaymentPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intents: PaymentIntentService,
    private readonly wallet: WalletService,
    private readonly receipts: ReceiptService,
    private readonly autoRecharge: AutoRechargeService,
  ) {}

  async authorize(
    context: ChargingFinancialContext,
    user: AuthUser,
    idempotencyKey: string,
    correlationId: string,
  ) {
    if (environment.paymentsMode === 'disabled') {
      return { mode: 'disabled' as const };
    }
    this.assertMockMode();
    const config = await this.policy(user.tenantId, context.currency);
    const money = Money.fromMinorUnits(
      config.preAuthorizationAmountMinor,
      context.currency,
      { maximumAmountMinor: environment.maximumMoneyMinor },
    );
    await this.wallet.get(user, context.currency);
    const key = `charging-authorization:${context.chargingSessionId}:${idempotencyKey}`;
    let intent = await this.intents.create(
      {
        chargingSessionId: context.chargingSessionId,
        idempotencyKey: key,
        money,
        provider: 'solis-wallet',
        type: PaymentIntentType.CHARGING_AUTHORIZATION,
      },
      user,
    );
    if (
      intent.status === PaymentIntentStatus.AUTHORIZED ||
      intent.status === PaymentIntentStatus.CAPTURED
    ) {
      return { intentId: intent.id, mode: 'wallet' as const };
    }
    if (intent.status === PaymentIntentStatus.CREATED) {
      intent = await this.intents.transition(
        intent.id,
        PaymentIntentStatus.PENDING,
        user,
      );
    }
    try {
      const reservation = await this.wallet.reserve({
        chargingSessionId: context.chargingSessionId,
        correlationId,
        idempotencyKey: key,
        money,
        paymentIntentId: intent.id,
        user,
      });
      intent = await this.intents.transition(
        intent.id,
        PaymentIntentStatus.AUTHORIZED,
        user,
        {
          authorizedAmountMinor: money.amountMinor,
          providerReference: `wallet_${reservation.id}`,
        },
      );
      return {
        amountMinor: intent.authorizedAmountMinor.toString(),
        intentId: intent.id,
        mode: 'wallet' as const,
        reservationId: reservation.id,
      };
    } catch (error) {
      const latest = await this.prisma.paymentIntent.findUnique({
        where: { id: intent.id },
      });
      if (latest?.status === PaymentIntentStatus.AUTHORIZED) {
        const reservation = await this.prisma.walletReservation.findUniqueOrThrow({
          where: { paymentIntentId: intent.id },
        });
        return {
          amountMinor: latest.authorizedAmountMinor.toString(),
          intentId: latest.id,
          mode: 'wallet' as const,
          reservationId: reservation.id,
        };
      }
      if (latest?.status === PaymentIntentStatus.PENDING) {
        await this.intents.transition(
          intent.id,
          PaymentIntentStatus.FAILED,
          user,
          { metadata: { reason: 'FINANCIAL_AUTHORIZATION_FAILED' } },
        );
      }
      throw error;
    }
  }

  async settle(
    context: ChargingFinancialContext,
    amount: Money,
    user: AuthUser,
    correlationId: string,
  ): Promise<ReceiptDto | null> {
    if (environment.paymentsMode === 'disabled') return null;
    this.assertMockMode();
    const intent = await this.sessionIntent(context.chargingSessionId, user);
    if (intent.status === PaymentIntentStatus.CAPTURED) {
      return this.receipts.issue(
        context.chargingSessionId,
        intent.id,
        amount,
        user,
        correlationId,
      );
    }
    if (intent.status !== PaymentIntentStatus.AUTHORIZED) {
      throw new ConflictException({
        code: 'PAYMENT_NOT_AUTHORIZED',
        message: 'A sessao nao possui autorizacao financeira valida.',
      });
    }
    const config = await this.policy(user.tenantId, amount.currency);
    if (
      amount.amountMinor > intent.authorizedAmountMinor ||
      amount.amountMinor > config.maximumSessionAmountMinor
    ) {
      await this.intents.transition(
        intent.id,
        PaymentIntentStatus.REQUIRES_REVIEW,
        user,
        {
          metadata: {
            reason: 'FINAL_AMOUNT_EXCEEDS_AUTHORIZATION',
            requestedAmountMinor: amount.amountMinor.toString(),
          },
        },
      );
      throw new ConflictException({
        code: 'CAPTURE_EXCEEDS_AUTHORIZATION',
        message: 'O valor final excede a autorizacao e exige revisao.',
      });
    }
    const reservation = await this.prisma.walletReservation.findUnique({
      where: { chargingSessionId: context.chargingSessionId },
    });
    if (!reservation) {
      throw new NotFoundException('Reserva financeira da sessao nao encontrada.');
    }
    await this.wallet.captureReserved(reservation.id, {
      correlationId,
      idempotencyKey: `charging-settlement:${context.chargingSessionId}`,
      money: amount,
      user,
    });
    const captured = await this.intents.transition(
      intent.id,
      PaymentIntentStatus.CAPTURED,
      user,
      { capturedAmountMinor: amount.amountMinor },
    );
    const receipt = await this.receipts.issue(
      context.chargingSessionId,
      captured.id,
      amount,
      user,
      correlationId,
    );
    await this.autoRecharge.evaluate(user, correlationId);
    return receipt;
  }

  async cancel(
    chargingSessionId: string,
    user: AuthUser,
    correlationId: string,
  ): Promise<void> {
    if (environment.paymentsMode === 'disabled') return;
    this.assertMockMode();
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        chargingSessionId,
        deletedAt: null,
        tenantId: user.tenantId,
        type: PaymentIntentType.CHARGING_AUTHORIZATION,
        userId: user.sub,
      },
    });
    if (!intent) return;
    const reservation = await this.prisma.walletReservation.findUnique({
      where: { chargingSessionId },
    });
    if (
      reservation &&
      reservation.status === WalletReservationStatus.RESERVED
    ) {
      await this.wallet.releaseReserved(reservation.id, {
        correlationId,
        idempotencyKey: `charging-cancel:${chargingSessionId}`,
        user,
      });
    }
    if (
      intent.status === PaymentIntentStatus.CREATED ||
      intent.status === PaymentIntentStatus.PENDING ||
      intent.status === PaymentIntentStatus.AUTHORIZED
    ) {
      await this.intents.transition(
        intent.id,
        PaymentIntentStatus.CANCELLED,
        user,
      );
    }
  }

  private async sessionIntent(chargingSessionId: string, user: AuthUser) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        chargingSessionId,
        deletedAt: null,
        tenantId: user.tenantId,
        type: PaymentIntentType.CHARGING_AUTHORIZATION,
        userId: user.sub,
      },
    });
    if (!intent) throw new NotFoundException('Pagamento da sessao nao encontrado.');
    return intent;
  }

  private async policy(tenantId: string, currency: string) {
    const policy = await this.prisma.paymentPolicyConfig.findUnique({
      where: { tenantId_currency: { currency, tenantId } },
    });
    if (!policy) {
      throw new ConflictException({
        code: 'PAYMENT_POLICY_MISSING',
        message: 'Configuracao financeira do tenant ausente.',
      });
    }
    return policy;
  }

  private assertMockMode(): void {
    if (environment.paymentsMode !== 'mock') {
      throw new ConflictException({
        code: 'PAYMENTS_MODE_UNAVAILABLE',
        message: `Pagamento de sessao indisponivel em PAYMENTS_MODE=${environment.paymentsMode}.`,
      });
    }
  }
}
