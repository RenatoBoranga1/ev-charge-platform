import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import {
  type AuthUser,
  CurrentUser,
} from '../auth/auth-user';
import type { CorrelatedRequest } from '../common/correlation-id.middleware';
import { ChargingService } from './charging.service';
import { CreateChargingSessionDto } from './dto/create-charging-session.dto';
import { ValidateQrDto } from './dto/validate-qr.dto';

function requiredIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || key.length > 160) {
    throw new BadRequestException({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key e obrigatoria e deve ter ate 160 caracteres.',
    });
  }
  return key;
}

@ApiBearerAuth()
@ApiTags('charging')
@Controller('v1/charging-sessions')
export class ChargingController {
  constructor(private readonly charging: ChargingService) {}

  @Post('validate-qr')
  validateQr(@Body() input: ValidateQrDto, @CurrentUser() user: AuthUser) {
    return this.charging.validateQr(input, user.tenantId);
  }

  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post()
  create(
    @Body() input: CreateChargingSessionDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: CorrelatedRequest,
  ) {
    return this.charging.create(
      input,
      user,
      requiredIdempotencyKey(idempotencyKey),
      request.correlationId,
    );
  }

  @Get('active')
  getActive(@CurrentUser() user: AuthUser) {
    return this.charging.getActive(user);
  }

  @Get(':id/metrics')
  getMetrics(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.charging.getMetrics(sessionId, user);
  }

  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/start')
  start(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: CorrelatedRequest,
  ) {
    return this.charging.start(
      sessionId,
      user,
      requiredIdempotencyKey(idempotencyKey),
      request.correlationId,
    );
  }

  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post(':id/stop')
  stop(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: CorrelatedRequest,
  ) {
    return this.charging.stop(
      sessionId,
      user,
      requiredIdempotencyKey(idempotencyKey),
      request.correlationId,
    );
  }

  @Get(':id')
  getById(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.charging.getById(sessionId, user);
  }
}
