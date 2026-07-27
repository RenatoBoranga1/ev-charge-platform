import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProfileTheme } from '@solis/database';

export class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  chargingNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  emailReceipts?: boolean;

  @IsOptional()
  @IsBoolean()
  favoriteStationAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  reservationAlerts?: boolean;
}

export class PrivacyPreferencesDto {
  @IsOptional()
  @IsBoolean()
  analyticsConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  personalizedOffers?: boolean;
}

export class UserPreferencesDto {
  @IsOptional()
  @IsBoolean()
  dataSaver?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{10,20}$/)
  phone?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  language?: string;

  @IsOptional()
  @IsEnum(ProfileTheme)
  theme?: ProfileTheme;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications?: NotificationPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrivacyPreferencesDto)
  privacy?: PrivacyPreferencesDto;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  recordVersion!: number;
}
