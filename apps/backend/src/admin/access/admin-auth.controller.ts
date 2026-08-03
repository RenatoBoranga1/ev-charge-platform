import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';

import { LoginDto } from '../../auth/dto/login.dto';
import { Public } from '../../auth/public.decorator';
import { environment } from '../../config/environment';
import {
  CurrentAdmin,
  RequireAdminPermissions,
  type AdminActor,
} from './admin-access';
import { AdminAuthService } from './admin-auth.service';

const refreshCookie = 'solis_admin_refresh';
const csrfCookie = 'solis_admin_csrf';

function cookies(request: Request): Record<string, string> {
  return Object.fromEntries(
    (request.header('cookie') ?? '')
      .split(';')
      .map((part) => part.trim().split('=', 2))
      .filter((part): part is [string, string] => part.length === 2)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

@ApiTags('admin-auth')
@Controller('v1/admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.adminAuth.login(input);
    this.setSessionCookies(response, result.refreshToken);
    return result.session;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Headers('x-csrf-token') csrfHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const values = cookies(request);
    if (
      !csrfHeader ||
      !values[csrfCookie] ||
      csrfHeader !== values[csrfCookie] ||
      !values[refreshCookie]
    ) {
      throw new UnauthorizedException('Proteção CSRF inválida.');
    }
    const result = await this.adminAuth.refresh(values[refreshCookie]);
    this.setSessionCookies(response, result.refreshToken);
    return result.session;
  }

  @RequireAdminPermissions()
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.adminAuth.logout(cookies(request)[refreshCookie]);
    response.clearCookie(refreshCookie, { path: '/v1/admin/auth' });
    response.clearCookie(csrfCookie, { path: '/' });
    return { success: true };
  }

  @RequireAdminPermissions()
  @Get('me')
  me(@CurrentAdmin() actor: AdminActor): AdminActor {
    return actor;
  }

  private setSessionCookies(response: Response, token: string): void {
    const secure = environment.nodeEnv === 'production';
    response.cookie(refreshCookie, token, {
      httpOnly: true,
      maxAge: environment.refreshTokenTtlDays * 86_400_000,
      path: '/v1/admin/auth',
      sameSite: 'strict',
      secure,
    });
    response.cookie(csrfCookie, randomBytes(24).toString('base64url'), {
      httpOnly: false,
      maxAge: environment.refreshTokenTtlDays * 86_400_000,
      path: '/',
      sameSite: 'strict',
      secure,
    });
  }
}
