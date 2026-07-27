import { Module } from '@nestjs/common';

import { OutboxModule } from '../outbox/outbox.module';
import {
  PrismaVehicleRepository,
  VehicleRepository,
} from './vehicle.repository';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [OutboxModule],
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    PrismaVehicleRepository,
    { provide: VehicleRepository, useExisting: PrismaVehicleRepository },
  ],
  exports: [VehiclesService],
})
export class VehiclesModule {}
