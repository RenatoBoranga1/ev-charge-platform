import {
  IsBoolean,
  IsIn,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class UpdateAutoRechargeDto {
  @IsBoolean()
  consentConfirmed!: boolean;

  @IsIn(['BRL'])
  currency!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Matches(/^\d{1,18}$/)
  minimumBalanceMinor!: string;

  @IsUUID()
  paymentMethodId!: string;

  @IsString()
  @Matches(/^\d{1,18}$/)
  rechargeAmountMinor!: string;
}
