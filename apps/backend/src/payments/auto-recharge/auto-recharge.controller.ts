import { Body, Controller, Delete, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../../auth/auth-user';
import type { CorrelatedRequest } from '../../common/correlation-id.middleware';
import { AutoRechargeService } from './auto-recharge.service';
import { UpdateAutoRechargeDto } from './dto/update-auto-recharge.dto';

@ApiBearerAuth()
@ApiTags('auto-recharge')
@Controller('v1/users/me/wallet/auto-recharge')
export class AutoRechargeController {
  constructor(private readonly autoRecharge: AutoRechargeService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.autoRecharge.get(user);
  }

  @Put()
  update(
    @Body() input: UpdateAutoRechargeDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.autoRecharge.update(input, user, request.correlationId);
  }

  @Delete()
  disable(
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.autoRecharge.disable(user, request.correlationId);
  }
}
