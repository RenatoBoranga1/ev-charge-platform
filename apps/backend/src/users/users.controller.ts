import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../auth/auth-user';
import type { CorrelatedRequest } from '../common/correlation-id.middleware';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UserProfileService,
  type UserProfileDto,
} from './user-profile.service';

@ApiBearerAuth()
@ApiTags('users')
@Controller('v1/users')
export class UsersController {
  constructor(private readonly users: UserProfileService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    return this.users.getProfile(user.sub);
  }

  @Patch('me')
  updateMe(
    @Body() input: UpdateProfileDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ): Promise<UserProfileDto> {
    return this.users.updateProfile(input, user, request.correlationId);
  }

  @Delete('me')
  requestDeletion(
    @Body() input: RequestAccountDeletionDto,
    @CurrentUser() user: AuthUser,
    @Req() request: CorrelatedRequest,
  ): Promise<UserProfileDto> {
    return this.users.requestAccountDeletion(
      user,
      input.recordVersion,
      request.correlationId,
    );
  }
}
