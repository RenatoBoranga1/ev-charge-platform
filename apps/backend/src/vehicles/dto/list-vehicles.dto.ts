import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { VehicleStatus, VehicleType } from '@solis/database';

export const vehicleSortFields = [
  'nickname',
  'brand',
  'createdAt',
  'year',
] as const;
export type VehicleSortField = (typeof vehicleSortFields)[number];

export class ListVehiclesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsIn(vehicleSortFields)
  sortBy: VehicleSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
