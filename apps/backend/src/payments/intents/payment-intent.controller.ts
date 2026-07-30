import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../../auth/auth-user';
import { TopUpService } from '../topups/top-up.service';
import { PaymentIntentService } from './payment-intent.service';

@ApiBearerAuth()
@ApiTags('payments')
@Controller('v1/users/me/payments')
export class PaymentIntentController {
  constructor(
    private readonly intents: PaymentIntentService,
    private readonly topUps: TopUpService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.intents.list(user);
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.intents.get(id, user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.topUps.cancel(id, user);
  }
}
