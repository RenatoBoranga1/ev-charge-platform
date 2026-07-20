import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { StationStatusBadge } from '@/components/StationStatusBadge';
import { useRoutePlannerStore } from '@/stores/route-planner-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatCurrency, formatDuration } from '@/utils/format';

export default function TripResultScreen() {
  const result = useRoutePlannerStore((state) => state.result);
  const { colors } = useAppTheme();

  if (!result) {
    return (
      <Screen>
        <AppHeader canGoBack title="Resultado da rota" />
        <EmptyState
          title="Nenhuma rota calculada"
          actionLabel="Planejar agora"
          onAction={() => router.replace('/(tabs)/trips/plan')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader canGoBack title="Sua rota está pronta" />
      <View style={styles.metrics}>
        <Metric label="Distância" value={result.distanceKm + ' km'} />
        <Metric label="Duração" value={formatDuration(result.durationMinutes * 60)} />
        <Metric label="Consumo" value={result.estimatedConsumptionKwh + ' kWh'} />
        <Metric label="Custo previsto" value={formatCurrency(result.estimatedChargingCost)} />
      </View>
      <AppCard>
        <Text style={[styles.title, { color: colors.text }]}>
          Bateria na chegada: {result.arrivalBatteryPercent}%
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          A estimativa considera o veículo, as preferências e condições mock de percurso.
        </Text>
      </AppCard>
      <Text style={[styles.title, { color: colors.text }]}>Paradas recomendadas</Text>
      {result.stops.map((stop) => (
        <AppCard key={stop.station.id}>
          <View style={styles.stopHeader}>
            <Text style={[styles.stopName, { color: colors.text }]}>
              {stop.station.name}
            </Text>
            <StationStatusBadge status={stop.station.status} />
          </View>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Chegada com {stop.arrivalBatteryPercent}% · recarga por {stop.chargeDurationMinutes} min · saída com {stop.departureBatteryPercent}%
          </Text>
        </AppCard>
      ))}
      <AppButton
        label="Ver estações no mapa"
        onPress={() => router.replace('/(tabs)/stations')}
      />
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  metricLabel: { fontSize: 12, fontWeight: '700' },
  metricValue: { fontSize: 18, fontWeight: '900', marginTop: 6 },
  title: { fontSize: 18, fontWeight: '900', marginTop: 16 },
  body: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stopName: { flex: 1, fontSize: 17, fontWeight: '800' },
});
