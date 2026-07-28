import type { ChargingHistoryFilters, DashboardQuery } from '@/types/domain';

export const dashboardKeys = {
  all: (userId: string) => ['dashboard', userId] as const,
  detail: (userId: string, query: DashboardQuery) => [...dashboardKeys.all(userId), query] as const,
};

export const chargingHistoryKeys = {
  all: (userId: string) => ['charging-history', userId] as const,
  list: (userId: string, filters: ChargingHistoryFilters) =>
    [...chargingHistoryKeys.all(userId), filters] as const,
};

export const chargingSessionKeys = {
  all: (userId: string) => ['charging-session-history', userId] as const,
  detail: (userId: string, sessionId: string) =>
    [...chargingSessionKeys.all(userId), sessionId, 'detail'] as const,
  metrics: (userId: string, sessionId: string) =>
    [...chargingSessionKeys.all(userId), sessionId, 'metrics'] as const,
  timeline: (userId: string, sessionId: string) =>
    [...chargingSessionKeys.all(userId), sessionId, 'timeline'] as const,
};

export async function invalidateChargingHistory(
  queryClient: {
    invalidateQueries(input: { queryKey: readonly unknown[] }): Promise<unknown>;
  },
  userId: string,
  sessionId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all(userId) }),
    queryClient.invalidateQueries({
      queryKey: chargingHistoryKeys.all(userId),
    }),
    queryClient.invalidateQueries({
      queryKey: chargingSessionKeys.detail(userId, sessionId),
    }),
  ]);
}
