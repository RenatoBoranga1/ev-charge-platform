import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class DashboardQueryDto {
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
}
