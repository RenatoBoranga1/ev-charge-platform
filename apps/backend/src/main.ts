import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { ApiExceptionFilter } from './common/api-exception.filter';
import { environment } from './config/environment';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.enableCors({
    origin: environment.corsOrigins,
  });
  app.useBodyParser('json', {
    limit: environment.httpPayloadLimit,
    verify(request: Request, _response: Response, buffer: Buffer) {
      (request as typeof request & { rawBody?: Buffer }).rawBody =
        Buffer.from(buffer);
    },
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Solis Plataformas API')
    .setDescription('API do monólito modular da plataforma de recarga.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(environment.port, '0.0.0.0');
}

void bootstrap();
