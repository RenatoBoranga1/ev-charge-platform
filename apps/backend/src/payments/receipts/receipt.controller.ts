import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../../auth/auth-user';
import { type ReceiptDto, ReceiptService } from './receipt.service';

@ApiBearerAuth()
@ApiTags('receipts')
@Controller('v1/users/me/charging-sessions')
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get(':id/receipt')
  get(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ReceiptDto> {
    return this.receipts.get(sessionId, user);
  }
}
