import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../../auth/auth-user';
import { CreateTopUpDto } from './dto/create-top-up.dto';
import { TopUpService } from './top-up.service';

@ApiBearerAuth()
@ApiTags('wallet-top-ups')
@Controller('v1/users/me/wallet/top-ups')
export class TopUpController {
  constructor(private readonly topUps: TopUpService) {}

  @Post()
  create(
    @Body() input: CreateTopUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.topUps.create(input, user);
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.topUps.get(id, user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.topUps.cancel(id, user);
  }
}
