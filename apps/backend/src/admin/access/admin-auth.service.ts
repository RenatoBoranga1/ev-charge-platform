import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AdminSession } from '@solis/admin-contracts';

import type { AuthUser } from '../../auth/auth-user';
import { AuthService } from '../../auth/auth.service';
import type { LoginDto } from '../../auth/dto/login.dto';
import { PrismaService } from '../../database/prisma.service';
import { AdminPermissionGuard } from './admin-permission.guard';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly permissionGuard: AdminPermissionGuard,
  ) {}

  async login(input: LoginDto): Promise<{
    refreshToken: string;
    session: AdminSession;
  }> {
    const authSession = await this.auth.login(input);
    const user = this.jwt.decode<AuthUser>(authSession.tokens.accessToken);
    if (!user) throw new UnauthorizedException('Sessão administrativa inválida.');
    return {
      refreshToken: authSession.tokens.refreshToken,
      session: await this.toSession(authSession.tokens.accessToken, user),
    };
  }

  async refresh(refreshToken: string): Promise<{
    refreshToken: string;
    session: AdminSession;
  }> {
    const tokens = await this.auth.refresh(refreshToken);
    const user = this.jwt.decode<AuthUser>(tokens.accessToken);
    if (!user) throw new UnauthorizedException('Sessão administrativa inválida.');
    return {
      refreshToken: tokens.refreshToken,
      session: await this.toSession(tokens.accessToken, user),
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.auth.revokeRefreshToken(refreshToken);
  }

  private async toSession(
    accessToken: string,
    user: AuthUser,
  ): Promise<AdminSession> {
    const membership = await this.prisma.operatorMembership.findFirst({
      include: { roleAssignments: true, tenant: true, user: true },
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    if (!membership || !membership.user) {
      await this.auth.revokeAllRefreshTokens(user.sub);
      throw new UnauthorizedException('Operador administrativo inativo.');
    }

    const roles = membership.roleAssignments.map(({ role }) => role);
    const permissions = [
      ...new Set(
        roles.flatMap((role) => {
          const normalized = role as keyof typeof import('@solis/admin-contracts').permissionsByRole;
          return import('@solis/admin-contracts').permissionsByRole[normalized] ?? [];
        }),
      ),
    ];
    return {
      accessToken,
      expiresInSeconds: 15 * 60,
      membership: {
        id: membership.id,
        name: membership.displayName,
        permissions,
        roles,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
      },
    };
  }
}
