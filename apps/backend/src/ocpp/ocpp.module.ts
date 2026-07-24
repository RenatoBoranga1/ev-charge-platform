import { Module } from '@nestjs/common';

import { ChargerEventRelay } from '../charging/gateway/charger-event-relay';
import { Ocpp16CentralSystemService } from './ocpp16-central-system.service';

@Module({
  providers: [ChargerEventRelay, Ocpp16CentralSystemService],
  exports: [ChargerEventRelay, Ocpp16CentralSystemService],
})
export class OcppModule {}