import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../auth/auth-user';
import { ChargingHistoryService } from './charging-history.service';
import { ChargingHistoryQueryDto } from './dto/charging-history-query.dto';
import { SessionMetricsQueryDto } from './dto/session-metrics-query.dto';

@ApiBearerAuth()
@ApiTags('charging-history')
@Controller('v1/users/me/charging-sessions')
export class ChargingHistoryController {
  constructor(private readonly history: ChargingHistoryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ChargingHistoryQueryDto,
  ) {
    return this.history.list(user, query);
  }

  @Get(':id/timeline')
  getTimeline(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.history.getTimeline(sessionId, user);
  }

  @Get(':id/metrics')
  getMetrics(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: SessionMetricsQueryDto,
  ) {
    return this.history.getMetrics(sessionId, user, query.maxPoints);
  }

  @Get(':id')
  getDetails(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.history.getDetails(sessionId, user);
  }
}
