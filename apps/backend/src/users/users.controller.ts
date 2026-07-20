import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../auth/auth-user';
import { VehiclesService, type VehicleDto } from '../vehicles/vehicles.service';
import { UsersService, type UserProfileDto } from './users.service';

@ApiBearerAuth()
@ApiTags('users')
@Controller('v1/users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly vehicles: VehiclesService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    return this.users.getProfile(user.sub);
  }

  @Get('me/vehicles')
  getVehicles(@CurrentUser() user: AuthUser): Promise<VehicleDto[]> {
    return this.vehicles.listForUser(user.sub);
  }
}
