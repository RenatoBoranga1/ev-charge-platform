import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  adminRoles,
  permissionsByRole,
  type AdminPermission,
} from '@solis/admin-contracts';

import { PrismaService } from '../../database/prisma.service';
import {
  adminPermissionsMetadata,
  type AdminRequest,
} from './admin-access';

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AdminPermission[]>(
      adminPermissionsMetadata,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined) return true;

    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Autenticação administrativa obrigatória.');
    }

    const membership = await this.prisma.operatorMembership.findFirst({
      include: { roleAssignments: true },
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        tenantId: request.user.tenantId,
        userId: request.user.sub,
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'ADMIN_MEMBERSHIP_REQUIRED',
        message: 'Acesso administrativo não autorizado.',
      });
    }

    const roles = membership.roleAssignments
      .map(({ role }) => role)
      .filter((role) => adminRoles.includes(role));
    const permissions = [
      ...new Set(roles.flatMap((role) => permissionsByRole[role])),
    ];
    if (required.some((permission) => !permissions.includes(permission))) {
      throw new ForbiddenException({
        code: 'ADMIN_PERMISSION_DENIED',
        message: 'Você não possui permissão para esta ação.',
      });
    }
    request.admin = {
      membershipId: membership.id,
      permissions,
      roles,
    };
    return true;
  }
}
