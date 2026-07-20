import {
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { IdempotencyService } from '../common/idempotency.service';
import { AuthService, type AuthSession, type AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Public()
  @Post('register')
  register(
    @Body() input: RegisterDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AuthSession> {
    return this.idempotency.execute(
      `auth:register:${input.email.trim().toLowerCase()}`,
      idempotencyKey,
      () => this.auth.register(input),
    );
  }

  @Public()
  @Post('login')
  login(@Body() input: LoginDto): Promise<AuthSession> {
    return this.auth.login(input);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() input: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(input.refreshToken);
  }
}
