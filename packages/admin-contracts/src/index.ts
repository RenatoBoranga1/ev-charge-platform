export const adminRoles = [
  'TENANT_ADMIN',
  'OPERATIONS_MANAGER',
  'STATION_OPERATOR',
  'FINANCE_ANALYST',
  'SUPPORT_AGENT',
  'VIEWER',
] as const;

export type AdminRole = (typeof adminRoles)[number];

export const adminPermissions = [
  'stations.read',
  'stations.create',
  'stations.update',
  'stations.archive',
  'charge_points.read',
  'charge_points.manage',
  'evses.read',
  'evses.manage',
  'connectors.read',
  'connectors.manage',
  'tariffs.read',
  'tariffs.create',
  'tariffs.publish',
  'tariffs.archive',
  'sessions.read',
  'sessions.remote_start',
  'sessions.remote_stop',
  'ocpp.reset',
  'ocpp.unlock_connector',
  'ocpp.change_availability',
  'ocpp.read_configuration',
  'drivers.read',
  'drivers.block',
  'drivers.unblock',
  'payments.read',
  'payments.refund',
  'payments.reconcile',
  'reports.read',
  'reports.export',
  'users.read',
  'users.invite',
  'users.assign_roles',
  'users.disable',
  'audit.read',
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

const readOnlyPermissions: AdminPermission[] = [
  'stations.read',
  'charge_points.read',
  'evses.read',
  'connectors.read',
  'tariffs.read',
  'sessions.read',
  'drivers.read',
  'payments.read',
  'reports.read',
];

export const permissionsByRole: Record<AdminRole, readonly AdminPermission[]> = {
  TENANT_ADMIN: adminPermissions,
  OPERATIONS_MANAGER: adminPermissions.filter(
    (permission) =>
      !permission.startsWith('users.') &&
      permission !== 'payments.refund' &&
      permission !== 'audit.read',
  ),
  STATION_OPERATOR: [
    ...readOnlyPermissions.filter((permission) => permission !== 'payments.read'),
    'stations.update',
    'charge_points.manage',
    'evses.manage',
    'connectors.manage',
    'sessions.remote_start',
    'sessions.remote_stop',
  ],
  FINANCE_ANALYST: [
    'payments.read',
    'payments.refund',
    'payments.reconcile',
    'reports.read',
    'reports.export',
    'sessions.read',
    'audit.read',
  ],
  SUPPORT_AGENT: [
    'drivers.read',
    'drivers.block',
    'drivers.unblock',
    'sessions.read',
    'payments.read',
    'stations.read',
    'charge_points.read',
    'evses.read',
    'connectors.read',
  ],
  VIEWER: readOnlyPermissions,
};

export const remoteCommandTypes = [
  'REMOTE_START',
  'REMOTE_STOP',
  'RESET',
  'UNLOCK_CONNECTOR',
  'CHANGE_AVAILABILITY',
  'GET_CONFIGURATION',
] as const;

export type RemoteCommandType = (typeof remoteCommandTypes)[number];

export const supportedRemoteCommandTypes: readonly RemoteCommandType[] = [
  'REMOTE_START',
  'REMOTE_STOP',
];

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface AdminSession {
  accessToken: string;
  expiresInSeconds: number;
  membership: {
    id: string;
    name: string;
    permissions: AdminPermission[];
    roles: AdminRole[];
    tenantId: string;
    tenantName: string;
  };
}

export interface AdminMetric {
  label: string;
  value: number | string;
  trend?: number | null;
}
