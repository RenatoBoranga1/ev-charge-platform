import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PlugType, VehicleStatus, VehicleType } from '@solis/database';

export class CreateVehicleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nickname!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  brand!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1886)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{7,10}$/)
  licensePlate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$/)
  vin?: string;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(500)
  batteryCapacityKwh!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3000)
  estimatedRangeKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(200)
  averageConsumptionKwhPer100Km?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(100)
  maximumAcPowerKw?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(1000)
  maximumDcPowerKw?: number;

  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(PlugType, { each: true })
  supportedPlugTypes!: PlugType[];

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
