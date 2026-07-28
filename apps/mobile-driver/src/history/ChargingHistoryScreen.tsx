import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { dashboardPeriodQuery } from '@/dashboard/periods';
import { useAppTheme } from '@/theme/ThemeProvider';
import type {
  ChargingHistoryFilters as HistoryFilters,
  ChargingHistoryItem as HistoryItem,
  ChargingHistoryPage,
} from '@/types/domain';

import {
  ChargingHistoryEmptyState,
  ChargingHistoryErrorState,
  ChargingHistoryFilters,
  ChargingHistoryItem,
  ChargingHistorySkeleton,
} from './ChargingHistoryComponents';
import { chargingHistoryKeys } from './query-keys';

const initialPeriod = dashboardPeriodQuery('LAST_30_DAYS');

export function ChargingHistoryScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const [filters, setFilters] = useState<HistoryFilters>({
    ...initialPeriod,
    limit: 20,
    sort: 'RECENT',
  });
  const stableFilters = useMemo(() => filters, [filters]);
  const vehicles = useQuery({
    enabled: Boolean(user),
    queryFn: () => api.vehicles.list(),
    queryKey: ['vehicles', userId, 'history-filter'],
  });
  const history = useInfiniteQuery({
    enabled: Boolean(user),
    getNextPageParam: (lastPage: ChargingHistoryPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : null,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.history.list(stableFilters, pageParam ?? undefined, signal),
    queryKey: chargingHistoryKeys.list(userId, stableFilters),
    retry: 2,
  });
  const items = useMemo(
    () => history.data?.pages.flatMap((page: ChargingHistoryPage) => page.items) ?? [],
    [history.data?.pages],
  );

  const openDetails = useCallback((sessionId: string) => {
    router.push({
      params: { sessionId },
      pathname: '/(tabs)/history/[sessionId]',
    });
  }, []);
  const renderItem = useCallback(
    ({ item }: { item: HistoryItem }) => (
      <ChargingHistoryItem item={item} onPress={() => openDetails(item.id)} />
    ),
    [openDetails],
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = history;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (history.isLoading) {
    return (
      <Screen scroll={false}>
        <AppHeader canGoBack title="Histórico de recargas" />
        <ChargingHistorySkeleton />
      </Screen>
    );
  }
  if (history.isError && items.length === 0) {
    return (
      <Screen scroll={false}>
        <AppHeader canGoBack title="Histórico de recargas" />
        <ChargingHistoryErrorState
          message={history.error.message}
          onRetry={() => void history.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen} scroll={false}>
      <AppHeader canGoBack title="Histórico de recargas" />
      {history.isError ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          Os dados podem estar desatualizados. Verifique sua conexão.
        </Text>
      ) : null}
      <FlatList
        ListEmptyComponent={ChargingHistoryEmptyState}
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <ActivityIndicator
              accessibilityLabel="Carregando mais sessões"
              color={colors.primary}
            />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ChargingHistoryFilters
              filters={filters}
              onChange={setFilters}
              vehicles={vehicles.data ?? []}
            />
            <Text style={[styles.resultCount, { color: colors.textMuted }]}>
              {items.length} sessões carregadas
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        onRefresh={() => void history.refetch()}
        refreshing={history.isRefetching && !history.isFetchingNextPage}
        removeClippedSubviews
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 14, paddingBottom: 12 },
  list: { flexGrow: 1, paddingBottom: 28 },
  resultCount: { fontSize: 13 },
  screen: { paddingBottom: 0 },
});
