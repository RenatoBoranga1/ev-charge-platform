import { Injectable } from '@nestjs/common';
import { Prisma } from '@solis/database';

import { PrismaService } from '../../database/prisma.service';

const sensitiveKey =
  /password|secret|token|authorization|cookie|pan|cvv|pix|qr|providerToken/i;

function safeValue(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.slice(0, 512);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => safeValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([entryKey, entryValue]) => [
          entryKey,
          safeValue(entryValue, entryKey),
        ]),
    );
  }
  return value;
}

export interface AdminAuditInput {
  action: string;
  after?: unknown;
  before?: unknown;
  correlationId: string;
  entityId?: string;
  entityType: string;
  ipAddress?: string;
  justification?: string;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILED';
  result?: unknown;
  tenantId: string;
  userAgent?: string;
  userId: string;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: AdminAuditInput,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;
    await client.auditLog.create({
      data: {
        action: input.action,
        actorType: 'OPERATOR',
        after:
          input.after === undefined
            ? undefined
            : (safeValue(input.after) as Prisma.InputJsonValue),
        before:
          input.before === undefined
            ? undefined
            : (safeValue(input.before) as Prisma.InputJsonValue),
        correlationId: input.correlationId,
        entityId: input.entityId,
        entityType: input.entityType,
        ipAddress: input.ipAddress?.slice(0, 80),
        justification: input.justification?.slice(0, 500),
        outcome: input.outcome ?? 'SUCCESS',
        result:
          input.result === undefined
            ? undefined
            : (safeValue(input.result) as Prisma.InputJsonValue),
        tenantId: input.tenantId,
        userAgent: input.userAgent?.slice(0, 500),
        userId: input.userId,
      },
    });
  }

  sanitize(value: unknown): unknown {
    return safeValue(value);
  }
}
