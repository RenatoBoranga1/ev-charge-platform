import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SessionMetricsQueryDto {
  @IsInt()
  @IsOptional()
  @Max(120)
  @Min(10)
  @Type(() => Number)
  maxPoints = 60;
}
