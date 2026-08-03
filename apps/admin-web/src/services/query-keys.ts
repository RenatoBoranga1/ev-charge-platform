export const adminDashboardKeys = {
  all: (tenantId: string) => ['admin', tenantId, 'dashboard'] as const,
};
export const adminStationKeys = {
  all: (tenantId: string, search: string) =>
    ['admin', tenantId, 'stations', search] as const,
};
export const adminTariffKeys = {
  all: (tenantId: string, status: string) =>
    ['admin', tenantId, 'tariffs', status] as const,
};
export const adminSessionKeys = {
  all: (tenantId: string, status: string) =>
    ['admin', tenantId, 'sessions', status] as const,
};
export const adminCommandKeys = {
  all: (tenantId: string) => ['admin', tenantId, 'commands'] as const,
};
export const adminDriverKeys = {
  all: (tenantId: string, search: string) =>
    ['admin', tenantId, 'drivers', search] as const,
};
export const adminPaymentKeys = {
  all: (tenantId: string) => ['admin', tenantId, 'payments'] as const,
};
export const adminReconciliationKeys = {
  all: (tenantId: string) => ['admin', tenantId, 'reconciliation'] as const,
};
export const adminOperatorKeys = {
  all: (tenantId: string) => ['admin', tenantId, 'operators'] as const,
};
export const adminAuditKeys = {
  all: (tenantId: string) => ['admin', tenantId, 'audit'] as const,
};
export const adminReportKeys = {
  all: (tenantId: string) => ['admin', tenantId, 'reports'] as const,
};
