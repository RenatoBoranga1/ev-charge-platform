import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class RequestAccountDeletionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  recordVersion!: number;
}
