import { Module } from '@nestjs/common';

import { ChargingHistoryController } from './charging-history.controller';
import { ChargingHistoryRepository } from './charging-history.repository';
import { ChargingHistoryService } from './charging-history.service';
import { HistoryCursorCodec } from './history-cursor';

@Module({
  controllers: [ChargingHistoryController],
  providers: [
    ChargingHistoryRepository,
    ChargingHistoryService,
    HistoryCursorCodec,
  ],
})
export class ChargingHistoryModule {}
