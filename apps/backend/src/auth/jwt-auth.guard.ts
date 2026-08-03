import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import { environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest, AuthUser } from './auth-user';
import { publicRouteMetadata } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      publicRouteMetadata,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    try {
      const user = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: environment.jwtAccessSecret,
      });
      const active = await this.prisma.user.findFirst({
        select: { id: true },
        where: {
          deletedAt: null,
          id: user.sub,
          isBlocked: false,
          tenantId: user.tenantId,
        },
      });
      if (!active) {
        throw new UnauthorizedException('Sessão revogada ou usuário bloqueado.');
      }
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }
}
