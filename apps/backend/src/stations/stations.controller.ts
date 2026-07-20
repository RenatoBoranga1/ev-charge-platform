import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../auth/auth-user';
import { NearbyStationsDto } from './dto/nearby-stations.dto';
import { StationsService, type StationDto } from './stations.service';

@ApiBearerAuth()
@ApiTags('stations')
@Controller('v1/stations')
export class StationsController {
  constructor(private readonly stations: StationsService) {}

  @Get('nearby')
  nearby(
    @Query() query: NearbyStationsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<StationDto[]> {
    return this.stations.nearby(query, user.tenantId);
  }

  @Get(':id')
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StationDto> {
    return this.stations.getById(id, user.tenantId);
  }
}
