import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaymentMethodType } from '@solis/database';

export class CreatePaymentMethodDto {
  @ValidateIf((input: CreatePaymentMethodDto) => input.type === PaymentMethodType.CARD)
  @IsString()
  @MaxLength(30)
  brand?: string;

  @ValidateIf((input: CreatePaymentMethodDto) => input.type === PaymentMethodType.CARD)
  @IsInt()
  @Min(1)
  @Max(12)
  expirationMonth?: number;

  @ValidateIf((input: CreatePaymentMethodDto) => input.type === PaymentMethodType.CARD)
  @IsInt()
  @Min(2020)
  @Max(2200)
  expirationYear?: number;

  @IsOptional()
  @IsBoolean()
  isDefault = false;

  @ValidateIf((input: CreatePaymentMethodDto) => input.type === PaymentMethodType.CARD)
  @IsString()
  @Matches(/^\d{4}$/)
  lastFour?: string;

  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;
}
