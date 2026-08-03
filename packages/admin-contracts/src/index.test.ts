import { describe, expect, it } from 'vitest';

import {
  adminPermissions,
  adminRoles,
  permissionsByRole,
  remoteCommandTypes,
  supportedRemoteCommandTypes,
} from './index';

describe('admin contracts', () => {
  it('keeps every role mapped to unique known permissions', () => {
    for (const role of adminRoles) {
      const permissions = permissionsByRole[role];

      expect(new Set(permissions).size).toBe(permissions.length);
      expect(permissions.every((permission) => adminPermissions.includes(permission))).toBe(
        true,
      );
    }
  });

  it('grants the tenant administrator every permission', () => {
    expect(permissionsByRole.TENANT_ADMIN).toEqual(adminPermissions);
  });

  it('keeps supported remote commands inside the protocol command catalog', () => {
    expect(
      supportedRemoteCommandTypes.every((command) => remoteCommandTypes.includes(command)),
    ).toBe(true);
    expect(supportedRemoteCommandTypes).toEqual(['REMOTE_START', 'REMOTE_STOP']);
  });
});