import {
  MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ChargingHistoryModule } from './charging-history/charging-history.module';
import { ChargingModule } from './charging/charging.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { ConnectorsModule } from './connectors/connectors.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OutboxModule } from './outbox/outbox.module';
import { PaymentsModule } from './payments/payments.module';
import { RedisModule } from './redis/redis.module';
import { ReservationsModule } from './reservations/reservations.module';
import { StationsModule } from './stations/stations.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 120, ttl: 60_000 }],
    }),
    DatabaseModule,
    RedisModule,
    DashboardModule,
    AdminModule,
    OutboxModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    StationsModule,
    ConnectorsModule,
    ReservationsModule,
    ChargingHistoryModule,
    ChargingModule,
    PaymentsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
