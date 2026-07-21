import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';
import type { CorrelatedRequest } from '../common/correlation-id.middleware';
import { ChargingService } from './charging.service';
import { ChargerEventDto } from './dto/charger-event.dto';

@ApiExcludeController()
@Public()
@Controller('internal/charger-events')
export class InternalChargerEventsController {
  constructor(private readonly charging: ChargingService) {}

  @HttpCode(204)
  @Post()
  async receive(
    @Body() input: ChargerEventDto,
    @Headers('x-simulator-secret') secret: string | undefined,
    @Req() request: CorrelatedRequest,
  ): Promise<void> {
    this.charging.assertSimulatorSecret(secret);
    await this.charging.handleChargerEvent(input, request.correlationId);
  }
}
