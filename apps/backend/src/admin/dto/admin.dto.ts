import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  adminRoles,
  remoteCommandTypes,
  type AdminRole,
  type RemoteCommandType,
} from '@solis/admin-contracts';
import { ConnectorStatus, StationStatus } from '@solis/database';

export class AdminListQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  status?: string;
}

export class CreateStationDto {
  @IsString()
  @Length(2, 160)
  address!: string;

  @IsString()
  @Length(2, 100)
  city!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsUUID()
  operatorId!: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  postalCode?: string;

  @IsString()
  @Length(2, 40)
  state!: string;
}

export class UpdateStationDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  city?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsIn(Object.values(StationStatus))
  status?: StationStatus;
}

export class CreateTariffDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  activationFee = 0;

  @IsString()
  @Length(3, 3)
  currency = 'BRL';

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  parkingFeeHour = 0;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  pricePerKwh!: number;

  @IsUUID()
  stationId!: string;

  @IsOptional()
  @IsString()
  validFrom?: string;
}

export class RemoteCommandDto {
  @IsOptional()
  @IsUUID()
  chargePointId?: string;

  @IsOptional()
  @IsUUID()
  chargingSessionId?: string;

  @IsOptional()
  @IsUUID()
  connectorId?: string;

  @IsString()
  @Length(8, 500)
  reason!: string;

  @IsIn(remoteCommandTypes)
  type!: RemoteCommandType;
}

export class DriverActionDto {
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class RefundPaymentDto {
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export class InviteOperatorDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsArray()
  @IsIn(adminRoles, { each: true })
  roles!: AdminRole[];
}

export class AssignOperatorRolesDto {
  @IsArray()
  @IsIn(adminRoles, { each: true })
  roles!: AdminRole[];
}

export class ConnectorStatusDto {
  @IsIn(Object.values(ConnectorStatus))
  status!: ConnectorStatus;

  @IsInt()
  @Min(1)
  version!: number;
}
