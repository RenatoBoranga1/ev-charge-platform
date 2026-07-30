import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LedgerTransactionStatus,
  LedgerTransactionType,
} from '@solis/database';

export class ListWalletTransactionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEnum(LedgerTransactionStatus)
  status?: LedgerTransactionStatus;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(LedgerTransactionType)
  type?: LedgerTransactionType;
}
