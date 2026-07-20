import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../auth/auth-user';
import { ChargingService } from './charging.service';
import { ValidateQrDto } from './dto/validate-qr.dto';

@ApiBearerAuth()
@ApiTags('charging')
@Controller('v1/charging-sessions')
export class ChargingController {
  constructor(private readonly charging: ChargingService) {}

  @Post('validate-qr')
  validateQr(@Body() input: ValidateQrDto, @CurrentUser() user: AuthUser) {
    return this.charging.validateQr(input, user.tenantId);
  }
}
