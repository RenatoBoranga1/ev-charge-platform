import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser } from '../../auth/auth-user';
import { ListWalletTransactionsDto } from './dto/list-wallet-transactions.dto';
import { WalletService } from './wallet.service';

@ApiBearerAuth()
@ApiTags('wallet')
@Controller('v1/users/me/wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.wallet.get(user);
  }

  @Get('transactions')
  transactions(
    @CurrentUser() user: AuthUser,
    @Query() filters: ListWalletTransactionsDto,
  ) {
    return this.wallet.transactions(user, {
      ...filters,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
  }
}
