import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ChargerEventDto {
  @ApiProperty({ enum: ['METER_VALUE', 'FAILED', 'DISCONNECTED'] })
  @IsIn(['METER_VALUE', 'FAILED', 'DISCONNECTED'])
  type!: 'METER_VALUE' | 'FAILED' | 'DISCONNECTED';

  @IsUUID()
  sessionId!: string;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  meterWh?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  powerKw?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryPercent?: number;
}
