import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PaymentMethodStatus,
  PaymentMethodType,
  Prisma,
  type PaymentMethod,
} from '@solis/database';

import type { AuthUser } from '../../auth/auth-user';
import { environment } from '../../config/environment';
import { PrismaService } from '../../database/prisma.service';
import { DomainEventPublisher } from '../../outbox/domain-event-publisher';
import { secureReference } from '../financial-request-hash';
import type { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

export interface PaymentMethodDto {
  brand: string | null;
  expirationMonth: number | null;
  expirationYear: number | null;
  id: string;
  isDefault: boolean;
  lastFour: string | null;
  provider: string;
  status: PaymentMethodStatus;
  type: PaymentMethodType;
}

@Injectable()
export class PaymentMethodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async list(user: AuthUser): Promise<PaymentMethodDto[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      where: {
        deletedAt: null,
        status: { not: PaymentMethodStatus.REMOVED },
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    return methods.map((method) => this.toDto(method));
  }

  async create(
    input: CreatePaymentMethodDto,
    user: AuthUser,
    correlationId: string,
  ): Promise<PaymentMethodDto> {
    this.assertMockMode();
    if (
      input.type === PaymentMethodType.CARD &&
      (!input.brand ||
        !input.lastFour ||
        !input.expirationMonth ||
        !input.expirationYear)
    ) {
      throw new ConflictException('Dados tokenizados do cartao estao incompletos.');
    }
    return this.prisma.$transaction(
      async (client) => {
        const count = await client.paymentMethod.count({
          where: {
            deletedAt: null,
            status: PaymentMethodStatus.ACTIVE,
            tenantId: user.tenantId,
            userId: user.sub,
          },
        });
        const expired = this.isExpired(input.expirationMonth, input.expirationYear);
        const isDefault = !expired && (input.isDefault || count === 0);
        if (isDefault) {
          await client.paymentMethod.updateMany({
            data: { isDefault: false, version: { increment: 1 } },
            where: { isDefault: true, tenantId: user.tenantId, userId: user.sub },
          });
        }
        const method = await client.paymentMethod.create({
          data: {
            brand: input.brand,
            expirationMonth: input.expirationMonth,
            expirationYear: input.expirationYear,
            isDefault,
            lastFour: input.lastFour,
            provider: 'solis-mock',
            providerToken: `mock_${secureReference(randomUUID()).slice(0, 40)}`,
            status: expired
              ? PaymentMethodStatus.EXPIRED
              : PaymentMethodStatus.ACTIVE,
            tenantId: user.tenantId,
            type: input.type,
            userId: user.sub,
          },
        });
        await this.audit(
          client,
          user,
          correlationId,
          'PAYMENT_METHOD_CREATED',
          method,
        );
        return this.toDto(method);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async setDefault(
    methodId: string,
    user: AuthUser,
    correlationId: string,
  ): Promise<PaymentMethodDto[]> {
    await this.prisma.$transaction(
      async (client) => {
        const method = await this.owned(client, methodId, user);
        if (
          method.status !== PaymentMethodStatus.ACTIVE ||
          this.isExpired(method.expirationMonth, method.expirationYear)
        ) {
          throw new ConflictException('Metodo expirado, bloqueado ou removido.');
        }
        await client.paymentMethod.updateMany({
          data: { isDefault: false, version: { increment: 1 } },
          where: { isDefault: true, tenantId: user.tenantId, userId: user.sub },
        });
        const updated = await client.paymentMethod.update({
          data: { isDefault: true, version: { increment: 1 } },
          where: { id: method.id },
        });
        await this.audit(
          client,
          user,
          correlationId,
          'PAYMENT_METHOD_DEFAULT_CHANGED',
          updated,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.list(user);
  }

  async remove(
    methodId: string,
    user: AuthUser,
    correlationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (client) => {
      const method = await this.owned(client, methodId, user);
      await client.paymentMethod.update({
        data: {
          deletedAt: new Date(),
          isDefault: false,
          status: PaymentMethodStatus.REMOVED,
          version: { increment: 1 },
        },
        where: { id: method.id },
      });
      if (method.isDefault) {
        const next = await client.paymentMethod.findFirst({
          orderBy: { createdAt: 'desc' },
          where: {
            deletedAt: null,
            id: { not: method.id },
            status: PaymentMethodStatus.ACTIVE,
            tenantId: user.tenantId,
            userId: user.sub,
          },
        });
        if (next) {
          await client.paymentMethod.update({
            data: { isDefault: true, version: { increment: 1 } },
            where: { id: next.id },
          });
        }
      }
      await this.audit(
        client,
        user,
        correlationId,
        'PAYMENT_METHOD_REMOVED',
        method,
      );
    });
  }

  private owned(
    client: Prisma.TransactionClient,
    methodId: string,
    user: AuthUser,
  ): Promise<PaymentMethod> {
    return client.paymentMethod
      .findFirst({
        where: {
          deletedAt: null,
          id: methodId,
          tenantId: user.tenantId,
          userId: user.sub,
        },
      })
      .then((method) => {
        if (!method) throw new NotFoundException('Metodo de pagamento nao encontrado.');
        return method;
      });
  }

  private async audit(
    client: Prisma.TransactionClient,
    user: AuthUser,
    correlationId: string,
    action: string,
    method: PaymentMethod,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        action,
        after: {
          isDefault: method.isDefault,
          lastFour: method.lastFour,
          status: method.status,
          type: method.type,
        },
        correlationId,
        entityId: method.id,
        entityType: 'PaymentMethod',
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    await this.outbox.publish(
      {
        aggregateId: method.id,
        aggregateType: 'PaymentMethod',
        eventType: action,
        payload: { status: method.status, type: method.type },
        tenantId: user.tenantId,
      },
      client,
    );
  }

  private toDto(method: PaymentMethod): PaymentMethodDto {
    return {
      brand: method.brand,
      expirationMonth: method.expirationMonth,
      expirationYear: method.expirationYear,
      id: method.id,
      isDefault: method.isDefault,
      lastFour: method.lastFour,
      provider: method.provider,
      status: method.status,
      type: method.type,
    };
  }

  private isExpired(month?: number | null, year?: number | null): boolean {
    if (!month || !year) return false;
    const now = new Date();
    return year < now.getUTCFullYear() ||
      (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1);
  }

  private assertMockMode(): void {
    if (environment.paymentsMode !== 'mock') {
      throw new ConflictException('Metodos mock exigem PAYMENTS_MODE=mock.');
    }
  }
}
