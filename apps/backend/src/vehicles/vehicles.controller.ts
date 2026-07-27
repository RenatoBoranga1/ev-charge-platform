import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../auth/auth-user';
import type { CorrelatedRequest } from '../common/correlation-id.middleware';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesDto } from './dto/list-vehicles.dto';
import { RecordVersionDto } from './dto/record-version.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiBearerAuth()
@ApiTags('vehicles')
@Controller('v1/users/me/vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() filters: ListVehiclesDto,
  ) {
    return this.vehicles.listForUser(user.sub, filters);
  }

  @Post()
  create(
    @Body() input: CreateVehicleDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.vehicles.create(input, user, request.correlationId);
  }

  @Post(':id/default')
  setDefault(
    @Param('id', new ParseUUIDPipe()) vehicleId: string,
    @Body() input: RecordVersionDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.vehicles.setDefault(
      vehicleId,
      input.recordVersion,
      user,
      request.correlationId,
    );
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id', new ParseUUIDPipe()) vehicleId: string,
    @Body() input: RecordVersionDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.vehicles.duplicate(
      vehicleId,
      input.recordVersion,
      user,
      request.correlationId,
    );
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) vehicleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vehicles.getForUser(user.sub, vehicleId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) vehicleId: string,
    @Body() input: UpdateVehicleDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ) {
    return this.vehicles.update(vehicleId, input, user, request.correlationId);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) vehicleId: string,
    @Body() input: RecordVersionDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ): Promise<void> {
    await this.vehicles.remove(
      vehicleId,
      input.recordVersion,
      user,
      request.correlationId,
    );
  }
}
