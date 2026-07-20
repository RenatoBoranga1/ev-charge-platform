import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { ConnectorBadge } from '@/components/ConnectorBadge';
import { Screen } from '@/components/Screen';
import { StationStatusBadge } from '@/components/StationStatusBadge';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatCurrency } from '@/utils/format';

export default function StationDetailsScreen() {
  const { stationId } = useLocalSearchParams<{ stationId: string }>();
  const { colors } = useAppTheme();
  const query = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => api.stations.getById(stationId),
    enabled: Boolean(stationId),
  });

  if (query.isLoading) {
    return <Screen><LoadingState title="Carregando detalhes" /></Screen>;
  }
  if (query.isError || !query.data) {
    return (
      <Screen>
        <ErrorState
          title="Estação indisponível"
          message="Não foi possível consultar esta estação."
          actionLabel="Tentar novamente"
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  }

  const station = query.data;

  return (
    <Screen>
      <AppHeader canGoBack title={station.name} subtitle={station.address} />
      <View style={styles.statusRow}>
        <StationStatusBadge status={station.status} />
        <Text style={[styles.rating, { color: colors.text }]}>
          ★ {station.rating.toFixed(1)}
        </Text>
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Informações da estação
        </Text>
        <InfoRow label="Distância" value={station.distanceKm.toFixed(1) + ' km'} />
        <InfoRow label="Funcionamento" value={station.openingHours} />
        <InfoRow label="Potência máxima" value={String(station.maximumPowerKw) + ' kW'} />
        <InfoRow label="Tarifa" value={formatCurrency(station.pricePerKwh) + '/kWh'} />
        <InfoRow
          label="Disponibilidade"
          value={String(station.availableConnectors) + ' de ' + String(station.totalConnectors) + ' conectores'}
        />
      </AppCard>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Conectores</Text>
      {station.connectors.map((connector) => (
        <AppCard key={connector.id} style={styles.connectorCard}>
          <View style={styles.connectorRow}>
            <ConnectorBadge
              plugType={connector.plugType}
              powerKw={connector.maximumPowerKw}
            />
            <StationStatusBadge status={connector.status} />
          </View>
          <Text style={[styles.connectorCode, { color: colors.textMuted }]}>
            Código {connector.code} · {connector.currentType}
          </Text>
        </AppCard>
      ))}

      <View style={styles.actions}>
        <AppButton
          label="Traçar rota"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/trips/plan',
              params: { destination: station.address },
            })
          }
        />
        <AppButton
          disabled={station.availableConnectors === 0}
          label="Reservar conector"
          onPress={() =>
            router.push({
              pathname: '/station/[stationId]/reserve',
              params: { stationId: station.id },
            })
          }
        />
      </View>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  rating: { fontWeight: '800' },
  sectionTitle: { marginTop: 18, marginBottom: 12, fontSize: 18, fontWeight: '800' },
  infoRow: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  connectorCard: { marginBottom: 10 },
  connectorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  connectorCode: { marginTop: 12, fontSize: 13 },
  actions: { gap: 10, marginTop: 20 },
});
