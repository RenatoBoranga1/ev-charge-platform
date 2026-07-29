import { Ionicons } from '@expo/vector-icons';
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
  const { colors, typeScale } = useAppTheme();
  const query = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => api.stations.getById(stationId),
    enabled: Boolean(stationId),
  });

  if (query.isLoading) {
    return (
      <Screen>
        <LoadingState title="Carregando detalhes" />
      </Screen>
    );
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
  const hasConnectors = station.connectors.length > 0;

  return (
    <Screen>
      <AppHeader canGoBack title="Detalhes da estação" />
      <View
        accessibilityLabel={`${station.name || 'Estação sem nome'}. ${
          station.address || 'Endereço não informado'
        }.`}
        style={[
          styles.hero,
          {
            backgroundColor: colors.primaryContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name="location" color={colors.primary} size={28} />
        </View>
        <View style={styles.heroCopy}>
          <Text
            accessibilityRole="header"
            style={[
              typeScale.headlineSmall,
              styles.heroTitle,
              { color: colors.onPrimaryContainer },
            ]}
          >
            {station.name || 'Estação sem nome'}
          </Text>
          <Text style={[typeScale.bodyMedium, { color: colors.onPrimaryContainer }]}>
            {station.address || 'Endereço não informado'}
          </Text>
          {station.operator ? (
            <Text style={[typeScale.labelMedium, { color: colors.onPrimaryContainer }]}>
              Operada por {station.operator}
            </Text>
          ) : null}
        </View>
        <View style={styles.heroStatus}>
          <StationStatusBadge status={station.status} />
          {station.rating > 0 ? (
            <View
              accessibilityLabel={`Avaliação ${station.rating.toFixed(1)} de 5`}
              style={styles.rating}
            >
              <Ionicons name="star" color={colors.warning} size={16} />
              <Text style={[styles.ratingText, { color: colors.onPrimaryContainer }]}>
                {station.rating.toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Informações da estação</Text>
        <InfoRow
          icon="navigate-outline"
          label="Distância"
          value={station.distanceKm > 0 ? `${station.distanceKm.toFixed(1)} km` : 'Não informada'}
        />
        <InfoRow
          icon="time-outline"
          label="Funcionamento"
          value={station.openingHours || 'Não informado'}
        />
        <InfoRow
          icon="flash-outline"
          label="Potência máxima"
          value={station.maximumPowerKw > 0 ? `${station.maximumPowerKw} kW` : 'Não informada'}
        />
        <InfoRow
          icon="pricetag-outline"
          label="Tarifa"
          value={
            station.pricePerKwh > 0 ? `${formatCurrency(station.pricePerKwh)}/kWh` : 'Não informada'
          }
        />
        <InfoRow
          icon="git-network-outline"
          label="Disponibilidade"
          value={
            station.totalConnectors > 0
              ? `${station.availableConnectors} de ${station.totalConnectors} conectores`
              : 'Não informada'
          }
        />
      </AppCard>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Conectores</Text>
      {hasConnectors ? (
        station.connectors.map((connector) => (
          <AppCard
            accessibilityLabel={`Conector ${connector.code}, ${connector.maximumPowerKw} quilowatts`}
            key={connector.id}
            style={styles.connectorCard}
          >
            <View style={styles.connectorRow}>
              <ConnectorBadge plugType={connector.plugType} powerKw={connector.maximumPowerKw} />
              <StationStatusBadge status={connector.status} />
            </View>
            <Text style={[styles.connectorCode, { color: colors.textMuted }]}>
              Código {connector.code} · {connector.currentType}
            </Text>
          </AppCard>
        ))
      ) : (
        <AppCard>
          <Text style={[styles.emptyConnectors, { color: colors.textMuted }]}>
            Os conectores desta estação ainda não foram informados.
          </Text>
        </AppCard>
      )}

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
        <AppButton label="Iniciar recarga" onPress={() => router.push('/(tabs)/charge')} />
        <AppButton
          disabled={station.availableConnectors === 0}
          label="Reservar conector"
          variant="outline"
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

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.infoRow, { borderBottomColor: colors.border }]}
    >
      <View style={styles.infoLabelRow}>
        <Ionicons name={icon} color={colors.primary} size={18} />
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10, marginTop: 8 },
  connectorCard: { marginBottom: 10 },
  connectorCode: { fontSize: 13, marginTop: 12 },
  connectorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  emptyConnectors: { fontSize: 14, lineHeight: 21 },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  heroCopy: { gap: 5 },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  heroStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroTitle: { fontWeight: '900' },
  infoLabel: { fontSize: 14 },
  infoLabelRow: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 8 },
  infoRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    minHeight: 54,
  },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  rating: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  ratingText: { fontSize: 13, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 8 },
});
