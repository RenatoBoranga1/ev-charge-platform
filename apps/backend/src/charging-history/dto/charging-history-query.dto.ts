import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChargingSessionStatus, PlugType } from '@solis/database';

export enum ChargingHistorySort {
  COST_ASC = 'COST_ASC',
  COST_DESC = 'COST_DESC',
  DURATION_ASC = 'DURATION_ASC',
  DURATION_DESC = 'DURATION_DESC',
  ENERGY_ASC = 'ENERGY_ASC',
  ENERGY_DESC = 'ENERGY_DESC',
  OLDEST = 'OLDEST',
  RECENT = 'RECENT',
}

export class ChargingHistoryQueryDto {
  @IsISO8601({ strict: true })
  @IsOptional()
  from?: string;

  @IsISO8601({ strict: true })
  @IsOptional()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  stationId?: string;

  @IsEnum(ChargingSessionStatus)
  @IsOptional()
  status?: ChargingSessionStatus;

  @IsEnum(PlugType)
  @IsOptional()
  connectorType?: PlugType;

  @IsBooleanString()
  @IsOptional()
  withCost?: string;

  @IsBooleanString()
  @IsOptional()
  failuresOnly?: string;

  @IsBooleanString()
  @IsOptional()
  completedOnly?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsEnum(ChargingHistorySort)
  @IsOptional()
  sort: ChargingHistorySort = ChargingHistorySort.RECENT;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsInt()
  @Max(50)
  @Min(1)
  @Type(() => Number)
  limit = 20;
}
