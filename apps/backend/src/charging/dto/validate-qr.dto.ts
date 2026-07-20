import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class ValidateQrDto {
  @ApiPropertyOptional({ enum: ['json', 'deep-link'] })
  @ValidateIf((input: ValidateQrDto) => !input.code)
  @IsIn(['json', 'deep-link'])
  source?: 'json' | 'deep-link';

  @ApiPropertyOptional()
  @ValidateIf((input: ValidateQrDto) => !input.code)
  @IsUUID()
  connectorId?: string;

  @ApiPropertyOptional()
  @ValidateIf((input: ValidateQrDto) => input.source === 'json')
  @IsUUID()
  stationId?: string;

  @ApiPropertyOptional()
  @ValidateIf((input: ValidateQrDto) => input.source === 'json')
  @IsUUID()
  chargePointId?: string;

  @ApiPropertyOptional()
  @ValidateIf((input: ValidateQrDto) => input.source === 'json')
  @IsUUID()
  evseId?: string;

  @ApiPropertyOptional({ example: 'SOLIS-001-A' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 1 })
  @ValidateIf((input: ValidateQrDto) => input.source === 'json')
  @IsIn([1])
  version?: number;

  @ApiPropertyOptional({ example: 'EV_CONNECTOR' })
  @ValidateIf((input: ValidateQrDto) => input.source === 'json')
  @IsIn(['EV_CONNECTOR'])
  type?: 'EV_CONNECTOR';
}
