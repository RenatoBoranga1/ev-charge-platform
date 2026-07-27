import { Module } from '@nestjs/common';

import { OutboxModule } from '../outbox/outbox.module';
import { UserProfileService } from './user-profile.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [OutboxModule],
  controllers: [UsersController],
  providers: [UserProfileService, UsersService],
  exports: [UserProfileService, UsersService],
})
export class UsersModule {}
