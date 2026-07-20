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
import { formatCurrency, formatDateTime, formatDuration } from '@/utils/format';

type StatusFilter = 'ALL' | 'COMPLETED' | 'FAILED';

export default function ChargingHistoryScreen() {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const query = useQuery({
    queryKey: ['charging-history'],
    queryFn: () => api.charging.getHistory(),
  });

  if (query.isLoading) return <Screen><LoadingState title="Carregando histórico" /></Screen>;
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

  const history = (query.data ?? []).filter((item) => status === 'ALL' || item.status === status);

  return (
    <Screen>
      <AppHeader canGoBack title="Histórico de recargas" />
      <View style={styles.filters}>
        <FilterChip label="Todas" selected={status === 'ALL'} onPress={() => setStatus('ALL')} />
        <FilterChip label="Concluídas" selected={status === 'COMPLETED'} onPress={() => setStatus('COMPLETED')} />
        <FilterChip label="Com falha" selected={status === 'FAILED'} onPress={() => setStatus('FAILED')} />
      </View>
      {history.length === 0 ? (
        <EmptyState title="Você ainda não realizou nenhuma recarga." />
      ) : (
        history.map((item) => (
          <AppCard key={item.id}>
            <Text style={[styles.station, { color: colors.text }]}>{item.stationName}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>{formatDateTime(item.startedAt)}</Text>
            <View style={styles.metrics}>
              <Text style={{ color: colors.text }}>{item.energyKwh.toFixed(1)} kWh</Text>
              <Text style={{ color: colors.text }}>{formatDuration(item.durationSeconds)}</Text>
              <Text style={[styles.amount, { color: colors.primary }]}>{formatCurrency(item.totalAmount)}</Text>
            </View>
            <Text
              accessibilityRole="link"
              onPress={() => Alert.alert('Recibo mock', item.paymentLabel + ' · ' + item.id)}
              style={[styles.receipt, { color: colors.secondary }]}
            >
              Abrir recibo
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
