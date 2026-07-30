import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReceiptStatus } from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { PrismaService } from '../../database/prisma.service';
import { DomainEventPublisher } from '../../outbox/domain-event-publisher';
import type { Money } from '../money';

const receiptInclude = {
  chargingSession: {
    include: {
      connector: true,
      station: true,
      user: true,
      vehicle: true,
    },
  },
  paymentIntent: true,
} satisfies Prisma.ReceiptInclude;

type ReceiptRecord = Prisma.ReceiptGetPayload<{ include: typeof receiptInclude }>;

export interface ReceiptDto {
  amountMinor: string;
  chargingSession: {
    completedAt: string | null;
    connector: string;
    durationSeconds: number;
    energyKwh: string;
    id: string;
    startedAt: string | null;
    station: string;
    stoppedAt: string | null;
    tariffSnapshot: Prisma.JsonValue;
    vehicle: {
      brand: string;
      model: string;
      plate: string | null;
    };
  };
  currency: string;
  issuedAt: string;
  payment: {
    id: string;
    method: string;
    reference: string | null;
    status: string;
  };
  receiptNumber: string;
  status: ReceiptStatus;
}

@Injectable()
export class ReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async issue(
    chargingSessionId: string,
    paymentIntentId: string,
    money: Money,
    user: AuthUser,
    correlationId: string,
  ): Promise<ReceiptDto> {
    const existing = await this.prisma.receipt.findUnique({
      include: receiptInclude,
      where: { chargingSessionId },
    });
    if (existing) {
      if (
        existing.paymentIntentId !== paymentIntentId ||
        existing.amountMinor !== money.amountMinor ||
        existing.currency !== money.currency
      ) {
        throw new Error('Existing receipt differs from the financial settlement.');
      }
      return this.toDto(existing);
    }

    return this.prisma.$transaction(async (client) => {
      const session = await client.chargingSession.findFirst({
        include: {
          connector: true,
          station: true,
          user: true,
          vehicle: true,
        },
        where: {
          deletedAt: null,
          id: chargingSessionId,
          station: { tenantId: user.tenantId },
          userId: user.sub,
        },
      });
      if (!session) throw new NotFoundException('Sessao nao encontrada.');
      const issuedAt = new Date();
      const receipt = await client.receipt.create({
        data: {
          amountMinor: money.amountMinor,
          chargingSessionId,
          currency: money.currency,
          paymentIntentId,
          receiptNumber: this.receiptNumber(issuedAt, chargingSessionId),
          snapshot: {
            connector: session.connector.code,
            durationSeconds:
              session.startedAt && session.stoppedAt
                ? Math.max(
                    0,
                    Math.floor(
                      (session.stoppedAt.getTime() -
                        session.startedAt.getTime()) /
                        1000,
                    ),
                  )
                : 0,
            energyKwh: session.energyKwh.toString(),
            station: session.station.name,
            tariff: session.tariffSnapshot,
            vehicle: {
              brand: session.vehicle.brand,
              model: session.vehicle.model,
              plate: session.vehicle.licensePlate,
            },
          },
          tenantId: user.tenantId,
          userId: user.sub,
        },
        include: receiptInclude,
      });
      await client.auditLog.create({
        data: {
          action: 'RECEIPT_ISSUED',
          after: {
            amountMinor: money.amountMinor.toString(),
            currency: money.currency,
            receiptNumber: receipt.receiptNumber,
          },
          correlationId,
          entityId: receipt.id,
          entityType: 'Receipt',
          tenantId: user.tenantId,
          userId: user.sub,
        },
      });
      await this.outbox.publish(
        {
          aggregateId: receipt.id,
          aggregateType: 'Receipt',
          eventType: 'ReceiptIssued',
          payload: {
            chargingSessionId,
            paymentIntentId,
            receiptNumber: receipt.receiptNumber,
          },
          tenantId: user.tenantId,
        },
        client,
      );
      return this.toDto(receipt);
    });
  }

  async get(chargingSessionId: string, user: AuthUser): Promise<ReceiptDto> {
    const receipt = await this.prisma.receipt.findFirst({
      include: receiptInclude,
      where: {
        chargingSessionId,
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    if (!receipt) throw new NotFoundException('Recibo nao encontrado.');
    return this.toDto(receipt);
  }

  async markRefunded(paymentIntentId: string): Promise<void> {
    await this.prisma.receipt.updateMany({
      data: { status: ReceiptStatus.REFUNDED },
      where: { paymentIntentId },
    });
  }

  private receiptNumber(issuedAt: Date, sessionId: string): string {
    const year = issuedAt.getUTCFullYear();
    return `SOLIS-${year}-${sessionId.replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  }

  private toDto(receipt: ReceiptRecord): ReceiptDto {
    const session = receipt.chargingSession;
    return {
      amountMinor: receipt.amountMinor.toString(),
      chargingSession: {
        completedAt: session.completedAt?.toISOString() ?? null,
        connector: session.connector.code,
        durationSeconds:
          session.startedAt && session.stoppedAt
            ? Math.max(
                0,
                Math.floor(
                  (session.stoppedAt.getTime() - session.startedAt.getTime()) /
                    1000,
                ),
              )
            : 0,
        energyKwh: session.energyKwh.toString(),
        id: session.id,
        startedAt: session.startedAt?.toISOString() ?? null,
        station: session.station.name,
        stoppedAt: session.stoppedAt?.toISOString() ?? null,
        tariffSnapshot: session.tariffSnapshot,
        vehicle: {
          brand: session.vehicle.brand,
          model: session.vehicle.model,
          plate: session.vehicle.licensePlate,
        },
      },
      currency: receipt.currency,
      issuedAt: receipt.issuedAt.toISOString(),
      payment: {
        id: receipt.paymentIntent.id,
        method: 'WALLET',
        reference: receipt.paymentIntent.providerReference
          ? `${receipt.paymentIntent.providerReference.slice(0, 12)}...`
          : null,
        status: receipt.paymentIntent.status,
      },
      receiptNumber: receipt.receiptNumber,
      status: receipt.status,
    };
  }
}
