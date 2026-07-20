import { Module } from '@nestjs/common';

import { StationsModule } from '../stations/stations.module';
import { ChargingController } from './charging.controller';
import { ChargingService } from './charging.service';

@Module({
  imports: [StationsModule],
  controllers: [ChargingController],
  providers: [ChargingService],
})
export class ChargingModule {}
