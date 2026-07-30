import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { IdempotencyService } from '../common/idempotency.service';
import { OcppModule } from '../ocpp/ocpp.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PaymentsModule } from '../payments/payments.module';
import { StationsModule } from '../stations/stations.module';
import { ChargingController } from './charging.controller';
import { ChargingRealtimeGateway } from './charging-realtime.gateway';
import { ChargingService } from './charging.service';
import { ChargerGateway } from './gateway/charger-gateway';
import { Ocpp16ChargerGateway } from './gateway/ocpp16-charger.gateway';
import { RoutingChargerGateway } from './gateway/routing-charger.gateway';
import { SimulatorChargerGateway } from './gateway/simulator-charger.gateway';
import { InternalChargerEventsController } from './internal-charger-events.controller';

@Module({
  imports: [AuthModule, OcppModule, OutboxModule, PaymentsModule, StationsModule],
  controllers: [ChargingController, InternalChargerEventsController],
  providers: [
    ChargingService,
    ChargingRealtimeGateway,
    IdempotencyService,
    SimulatorChargerGateway,
    Ocpp16ChargerGateway,
    RoutingChargerGateway,
    { provide: ChargerGateway, useExisting: RoutingChargerGateway },
  ],
  exports: [ChargingService],
})
export class ChargingModule {}
