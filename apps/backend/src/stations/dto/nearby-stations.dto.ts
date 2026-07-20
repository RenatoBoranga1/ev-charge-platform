import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class NearbyStationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude = -23.55052;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude = -46.633308;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(200)
  distanceKm = 25;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumPowerKw = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximumPricePerKwh = 100;
}
