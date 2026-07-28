import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { dashboardKeys } from '@/history/query-keys';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { DashboardQuery } from '@/types/domain';
import { formatMoney } from '@/utils/format';

import {
  Co2SummaryCard,
  DashboardEmptyState,
  DashboardErrorState,
  DashboardHeader,
  DashboardPeriodSelector,
  DashboardSkeleton,
  EnergySummaryCard,
  FavoriteStationCard,
  LastChargingSessionCard,
  MonthlySummaryCard,
  PrimaryVehicleSummary,
  QuickActions,
  SavingsSummaryCard,
  SessionsSummaryCard,
} from './DashboardComponents';
import { dashboardPeriodQuery, type DashboardPeriodPreset, periodLabel } from './periods';

export function DashboardScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const [preset, setPreset] = useState<DashboardPeriodPreset>('CURRENT_MONTH');
  const [periodQuery, setPeriodQuery] = useState<DashboardQuery>(() =>
    dashboardPeriodQuery('CURRENT_MONTH'),
  );
  const stableQuery = useMemo(() => periodQuery, [periodQuery]);
  const dashboard = useQuery({
    enabled: Boolean(user),
    queryFn: ({ signal }) => api.dashboard.get(stableQuery, signal),
    queryKey: dashboardKeys.detail(userId, stableQuery),
    retry: 2,
  });

  const changePeriod = (selected: DashboardPeriodPreset, custom?: DashboardQuery) => {
    setPreset(selected);
    if (custom) setPeriodQuery(custom);
    else if (selected !== 'CUSTOM') {
      setPeriodQuery(dashboardPeriodQuery(selected));
    }
  };

  if (dashboard.isLoading) {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }
  if (dashboard.isError) {
    return (
      <Screen>
        <DashboardErrorState
          message={dashboard.error.message}
          onRetry={() => void dashboard.refetch()}
        />
      </Screen>
    );
  }
  const data = dashboard.data;
  if (!data) return null;

  return (
    <Screen contentStyle={styles.content}>
      <DashboardHeader name={data.driver.firstName} />
      <DashboardPeriodSelector onChange={changePeriod} selected={preset} />
      <Text style={[styles.period, { color: colors.textMuted }]}>{periodLabel(data.period)}</Text>
      <PrimaryVehicleSummary vehicle={data.primaryVehicle} />
      {data.summary.totalSessions === 0 ? (
        <DashboardEmptyState onMap={() => router.push('/(tabs)/stations')} />
      ) : (
        <>
          <View style={styles.grid}>
            <MonthlySummaryCard value={data.summary.totalSessions} />
            <EnergySummaryCard value={data.summary.totalEnergyKwh} />
            <SessionsSummaryCard value={data.summary.totalDurationSeconds} />
            {data.summary.totalCost && data.summary.currency ? (
              <AppCard
                accessibilityLabel={`Custo total ${formatMoney(
                  data.summary.totalCost,
                  data.summary.currency,
                )}`}
                style={styles.costCard}
              >
                <Text style={[styles.cost, { color: colors.text }]}>
                  {formatMoney(data.summary.totalCost, data.summary.currency)}
                </Text>
                <Text style={{ color: colors.textMuted }}>Custo total</Text>
              </AppCard>
            ) : null}
            <SavingsSummaryCard value={data.summary.estimatedSavings} />
            <Co2SummaryCard value={data.summary.avoidedCo2Kg} />
          </View>
          {data.lastSession ? (
            <LastChargingSessionCard
              onPress={() =>
                router.push({
                  params: { sessionId: data.lastSession!.id },
                  pathname: '/(tabs)/history/[sessionId]',
                })
              }
              session={data.lastSession}
            />
          ) : null}
          <FavoriteStationCard station={data.mostUsedStation} />
        </>
      )}
      <QuickActions
        onCharge={() => router.push('/(tabs)/charge')}
        onGarage={() => router.push('/(tabs)/vehicles')}
        onHistory={() => router.push('/(tabs)/history')}
        onMap={() => router.push('/(tabs)/stations')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  cost: { fontSize: 23, fontWeight: '900' },
  costCard: { flex: 1, gap: 5, minWidth: 145 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  period: { fontSize: 13 },
});
