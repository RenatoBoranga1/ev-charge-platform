import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PaymentWebhookProcessingStatus,
  Prisma,
} from '@solis/database';

import { PrismaService } from '../../database/prisma.service';
import { financialRequestHash } from '../financial-request-hash';
import { PaymentGateway, type PaymentWebhook } from '../gateway/payment.gateway';
import { TopUpService } from '../topups/top-up.service';

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGateway,
    private readonly topUps: TopUpService,
  ) {}

  async handle(input: {
    body: unknown;
    correlationId: string;
    provider: string;
    rawBody: string;
    signature: string | undefined;
    timestamp: string | undefined;
  }): Promise<{ accepted: true; duplicate: boolean }> {
    if (input.provider !== this.gateway.provider) {
      throw new NotFoundException('Payment provider not configured.');
    }
    if (
      !this.gateway.validateWebhook({
        rawBody: input.rawBody,
        signature: input.signature,
        timestamp: input.timestamp,
      })
    ) {
      throw new UnauthorizedException('Invalid payment webhook signature.');
    }
    const parsed = this.gateway.parseWebhook(input.body);
    const payloadHash = financialRequestHash(input.rawBody);
    let event;
    try {
      event = await this.prisma.paymentWebhookEvent.create({
        data: {
          eventType: parsed.eventType,
          payloadHash,
          processingStatus: PaymentWebhookProcessingStatus.RECEIVED,
          provider: input.provider,
          providerEventId: parsed.providerEventId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.paymentWebhookEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: {
              provider: input.provider,
              providerEventId: parsed.providerEventId,
            },
          },
        });
        if (existing.payloadHash !== payloadHash) {
          await this.prisma.paymentWebhookEvent.update({
            data: {
              lastError: 'Provider event reused with another payload hash.',
              processingStatus: PaymentWebhookProcessingStatus.REQUIRES_REVIEW,
            },
            where: { id: existing.id },
          });
          throw new ConflictException({
            code: 'WEBHOOK_REPLAY_CONFLICT',
            message: 'Provider event id reused with another payload.',
          });
        }
        if (
          existing.processingStatus ===
          PaymentWebhookProcessingStatus.FAILED
        ) {
          const claimed = await this.prisma.paymentWebhookEvent.updateMany({
            data: {
              lastError: null,
              processingStatus: PaymentWebhookProcessingStatus.PROCESSING,
            },
            where: {
              id: existing.id,
              processingStatus: PaymentWebhookProcessingStatus.FAILED,
            },
          });
          if (claimed.count === 1) {
            await this.processEvent(
              existing.id,
              parsed,
              input.correlationId,
            );
          }
        }
        return { accepted: true, duplicate: true };
      }
      throw error;
    }

    await this.prisma.paymentWebhookEvent.update({
      data: { processingStatus: PaymentWebhookProcessingStatus.PROCESSING },
      where: { id: event.id },
    });
    await this.processEvent(event.id, parsed, input.correlationId);
    return { accepted: true, duplicate: false };
  }

  private async processEvent(
    eventId: string,
    parsed: PaymentWebhook,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.topUps.applyWebhook(parsed, correlationId);
      await this.prisma.paymentWebhookEvent.update({
        data: {
          processedAt: new Date(),
          processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
        },
        where: { id: eventId },
      });
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        data: {
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : 'Webhook processing failed.',
          processingStatus: PaymentWebhookProcessingStatus.FAILED,
        },
        where: { id: eventId },
      });
      throw error;
    }
  }
}
