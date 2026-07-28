import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatDateTime, formatDuration, formatMoney } from '@/utils/format';

type StatusFilter = 'all' | 'completed' | 'failed';

export default function ChargingHistoryScreen() {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<StatusFilter>('all');
  const query = useQuery({
    queryKey: ['charging-history', 'profile-shortcut', status],
    queryFn: () =>
      api.history.list({
        ...(status === 'all' ? {} : { status }),
        sort: 'RECENT',
      }),
  });

  if (query.isLoading)
    return (
      <Screen>
        <LoadingState title="Carregando histórico" />
      </Screen>
    );
  if (query.isError) {
    return (
      <Screen>
        <ErrorState
          title="Não foi possível carregar seu histórico"
          actionLabel="Tentar novamente"
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  }

  const history = query.data?.items ?? [];

  return (
    <Screen>
      <AppHeader canGoBack title="Histórico de recargas" />
      <View style={styles.filters}>
        <FilterChip label="Todas" selected={status === 'all'} onPress={() => setStatus('all')} />
        <FilterChip
          label="Concluídas"
          selected={status === 'completed'}
          onPress={() => setStatus('completed')}
        />
        <FilterChip
          label="Com falha"
          selected={status === 'failed'}
          onPress={() => setStatus('failed')}
        />
      </View>
      {history.length === 0 ? (
        <EmptyState title="Você ainda não realizou nenhuma recarga." />
      ) : (
        history.map((item) => (
          <AppCard key={item.id}>
            <Text style={[styles.station, { color: colors.text }]}>{item.station.name}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>
              {formatDateTime(item.startedAt)}
            </Text>
            <View style={styles.metrics}>
              <Text style={{ color: colors.text }}>{item.energyKwh.toFixed(1)} kWh</Text>
              <Text style={{ color: colors.text }}>{formatDuration(item.durationSeconds)}</Text>
              {item.cost ? (
                <Text style={[styles.amount, { color: colors.primary }]}>
                  {formatMoney(item.cost.amount, item.cost.currency)}
                </Text>
              ) : null}
            </View>
            <Text
              accessibilityRole="link"
              onPress={() => Alert.alert('Detalhes da sessão', item.station.name + ' · ' + item.id)}
              style={[styles.receipt, { color: colors.secondary }]}
            >
              Ver identificador da sessão
            </Text>
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  station: { fontSize: 17, fontWeight: '800' },
  date: { fontSize: 13, marginTop: 4 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  amount: { fontWeight: '900' },
  receipt: { minHeight: 44, textAlignVertical: 'center', fontWeight: '800', marginTop: 6 },
});
