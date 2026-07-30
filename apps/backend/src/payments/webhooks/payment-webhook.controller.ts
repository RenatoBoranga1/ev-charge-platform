import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../auth/public.decorator';
import type { CorrelatedRequest } from '../../common/correlation-id.middleware';
import { PaymentWebhookService } from './payment-webhook.service';

interface RawBodyRequest extends Request, CorrelatedRequest {
  rawBody?: Buffer;
}

@ApiTags('payment-webhooks')
@Controller('v1/webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly webhooks: PaymentWebhookService) {}

  @Public()
  @HttpCode(202)
  @Post(':provider')
  handle(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Headers('x-payment-signature') signature: string | undefined,
    @Headers('x-payment-timestamp') timestamp: string | undefined,
    @Req() request: RawBodyRequest,
  ) {
    const rawBody = request.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new Error('Raw webhook body is unavailable.');
    }
    return this.webhooks.handle({
      body,
      correlationId: request.correlationId,
      provider,
      rawBody,
      signature,
      timestamp,
    });
  }
}
