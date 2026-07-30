import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../../auth/auth-user';
import type { CorrelatedRequest } from '../../common/correlation-id.middleware';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodService } from './payment-method.service';

@ApiBearerAuth()
@ApiTags('payment-methods')
@Controller('v1/users/me/payment-methods')
export class PaymentMethodController {
  constructor(private readonly methods: PaymentMethodService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.methods.list(user);
  }

  @Post()
  create(
    @Body() input: CreatePaymentMethodDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.methods.create(input, user, request.correlationId);
  }

  @Patch(':id/default')
  setDefault(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.methods.setDefault(id, user, request.correlationId);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.methods.remove(id, user, request.correlationId);
  }
}
