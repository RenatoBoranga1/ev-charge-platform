import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateChargingSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  connectorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleId!: string;

  @ApiProperty({ example: 'account-default', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentMethodId?: string;
}
