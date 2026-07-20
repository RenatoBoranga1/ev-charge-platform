import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { CorrelatedRequest } from './correlation-id.middleware';

interface HttpErrorResponse {
  code?: string;
  message?: string | string[];
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & Partial<CorrelatedRequest>>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : null;
    const body =
      typeof raw === 'object' && raw !== null
        ? (raw as HttpErrorResponse)
        : { message: typeof raw === 'string' ? raw : undefined };
    const message =
      status === 500
        ? 'Erro interno do servidor.'
        : (body.message ?? 'A requisição não pôde ser processada.');

    if (status >= 500) {
      this.logger.error('Unhandled request error', exception);
    }

    response.status(status).json({
      code: body.code ?? `HTTP_${status}`,
      correlationId: request.correlationId ?? null,
      message,
      path: request.originalUrl,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
