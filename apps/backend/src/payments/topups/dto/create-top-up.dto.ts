import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import type { MockPaymentScenario } from '../../gateway/payment.gateway';

const scenarios: readonly MockPaymentScenario[] = [
  'approved',
  'pending',
  'declined',
  'timeout',
  'expired',
  'delayed-confirmation',
  'duplicate-webhook',
  'out-of-order-webhook',
  'unknown-status',
];

export class CreateTopUpDto {
  @IsString()
  @Matches(/^\d{1,18}$/)
  amountMinor!: string;

  @IsIn(['BRL'])
  currency!: string;

  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @IsIn(['PIX'])
  method!: 'PIX';

  @IsOptional()
  @IsIn(scenarios)
  scenario?: MockPaymentScenario;
}
