import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/AsyncState';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { Screen } from '@/components/Screen';
import { useChargingStore } from '@/stores/charging-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatDateTime, formatDuration } from '@/utils/format';

export default function CompletedChargeScreen() {
  const { colors } = useAppTheme();
  const summary = useChargingStore((state) => state.summary);
  const reset = useChargingStore((state) => state.reset);

  if (!summary) {
    return (
      <Screen>
        <AppHeader title="Resumo da recarga" />
        <EmptyState
          title="Resumo indisponível"
          actionLabel="Voltar ao mapa"
          onAction={() => router.replace('/(tabs)/stations')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Recarga concluída" subtitle="Pagamento mock capturado com sucesso" />
      <AppCard>
        <Text style={[styles.success, { color: colors.success }]}>
          Energia entregue
        </Text>
        <Text style={[styles.energy, { color: colors.text }]}>
          {summary.energyKwh.toFixed(2)} kWh
        </Text>
        <View style={styles.metrics}>
          <SummaryMetric label="Duração" value={formatDuration(summary.durationSeconds)} />
          <SummaryMetric label="CO₂ evitado" value={summary.avoidedCo2Kg.toFixed(2) + ' kg'} />
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Valores</Text>
        <PriceBreakdown price={summary.price} />
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Detalhes</Text>
        <Detail label="Estação" value={summary.session.stationName} />
        <Detail label="Conector" value={summary.session.connectorLabel} />
        <Detail label="Início" value={formatDateTime(summary.session.startedAt)} />
        <Detail label="Fim" value={formatDateTime(summary.stoppedAt)} />
        <Detail label="Sessão" value={summary.session.id} />
        <Detail label="Pagamento" value="Método tokenizado mock" />
      </AppCard>

      <AppButton
        label="Ver recibo"
        variant="secondary"
        onPress={() => Alert.alert('Recibo mock', 'O recibo foi preparado para envio por e-mail.')}
      />
      <AppButton
        label="Avaliar estação"
        variant="outline"
        onPress={() => Alert.alert('Obrigado!', 'Avaliação mock registrada.')}
      />
      <AppButton
        label="Reportar problema"
        variant="ghost"
        onPress={() => router.push('/(tabs)/profile/support')}
      />
      <AppButton
        label="Voltar ao mapa"
        onPress={() => {
          reset();
          router.replace('/(tabs)/stations');
        }}
      />
    </Screen>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.detail, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text selectable style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  success: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  energy: { fontSize: 40, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  metrics: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  metricLabel: { fontSize: 12, textAlign: 'center' },
  metricValue: { fontSize: 16, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },
  detail: {
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: { width: 80, fontSize: 13 },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700' },
});
