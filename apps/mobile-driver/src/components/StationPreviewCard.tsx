import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { AppCard } from './AppCard';
import { ConnectorBadge } from './ConnectorBadge';
import { StationStatusBadge } from './StationStatusBadge';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Station } from '@/types/domain';
import { formatCurrency } from '@/utils/format';

interface StationPreviewCardProps {
  station: Station;
  onDetails: () => void;
  onRoute: () => void;
  onReserve: () => void;
}

export function StationPreviewCard({
  station,
  onDetails,
  onRoute,
  onReserve,
}: StationPreviewCardProps) {
  const { colors } = useAppTheme();

  return (
    <AppCard>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={[styles.name, { color: colors.text }]}>{station.name}</Text>
          <Text style={[styles.address, { color: colors.textMuted }]}>
            {station.distanceKm.toFixed(1)} km · {station.address}
          </Text>
        </View>
        <StationStatusBadge status={station.status} />
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Ionicons name="flash" size={18} color={colors.primary} />
          <Text style={[styles.summaryText, { color: colors.text }]}>
            {station.availableConnectors}/{station.totalConnectors} livres
          </Text>
        </View>
        <Text style={[styles.summaryText, { color: colors.text }]}>
          até {station.maximumPowerKw} kW
        </Text>
        <Text style={[styles.summaryText, { color: colors.text }]}>
          {formatCurrency(station.pricePerKwh)}/kWh
        </Text>
      </View>
      <View style={styles.badges}>
        {station.plugTypes.map((plugType) => (
          <ConnectorBadge key={plugType} plugType={plugType} />
        ))}
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        ★ {station.rating.toFixed(1)} · {station.openingHours}
      </Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <AppButton label="Detalhes" onPress={onDetails} variant="outline" />
        </View>
        <View style={styles.action}>
          <AppButton label="Traçar rota" onPress={onRoute} variant="secondary" />
        </View>
      </View>
      <AppButton
        disabled={station.availableConnectors === 0}
        label="Reservar conector"
        onPress={onReserve}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingCopy: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800' },
  address: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 16,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryText: { fontSize: 13, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  meta: { fontSize: 13, marginVertical: 12 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  action: { flex: 1 },
});
