import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { AdminPermission, AdminRole } from '@solis/admin-contracts';

import type { AuthenticatedRequest } from '../../auth/auth-user';

export const adminPermissionsMetadata = 'solis:admin-permissions';

export const RequireAdminPermissions = (
  ...permissions: AdminPermission[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(adminPermissionsMetadata, permissions);

export interface AdminActor {
  membershipId: string;
  permissions: AdminPermission[];
  roles: AdminRole[];
}

export interface AdminRequest extends AuthenticatedRequest {
  admin: AdminActor;
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminActor =>
    context.switchToHttp().getRequest<AdminRequest>().admin,
);
