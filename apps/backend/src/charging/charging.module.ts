import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { IdempotencyService } from '../common/idempotency.service';
import { OutboxModule } from '../outbox/outbox.module';
import { StationsModule } from '../stations/stations.module';
import { ChargingController } from './charging.controller';
import { ChargingRealtimeGateway } from './charging-realtime.gateway';
import { ChargingService } from './charging.service';
import { ChargerGateway } from './gateway/charger-gateway';
import { SimulatorChargerGateway } from './gateway/simulator-charger.gateway';
import { InternalChargerEventsController } from './internal-charger-events.controller';

@Module({
  imports: [AuthModule, OutboxModule, StationsModule],
  controllers: [ChargingController, InternalChargerEventsController],
  providers: [
    ChargingService,
    ChargingRealtimeGateway,
    IdempotencyService,
    SimulatorChargerGateway,
    { provide: ChargerGateway, useExisting: SimulatorChargerGateway },
  ],
  exports: [ChargingService],
})
export class ChargingModule {}
