import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const correlationIdHeader = 'x-correlation-id';

export interface CorrelatedRequest extends Request {
  correlationId: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: CorrelatedRequest, response: Response, next: NextFunction): void {
    const candidate = request.header(correlationIdHeader);
    request.correlationId =
      candidate && candidate.length <= 128 ? candidate : randomUUID();
    response.setHeader(correlationIdHeader, request.correlationId);
    next();
  }
}
