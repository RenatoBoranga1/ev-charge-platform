import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from './AppCard';
import { ConnectorBadge } from './ConnectorBadge';
import { StationStatusBadge } from './StationStatusBadge';
import {
  OutlinedButton,
  PrimaryButton,
  SecondaryButton,
} from '@/design-system';
import { formatDistance } from '@/stations/discovery';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Station } from '@/types/domain';
import { formatCurrency } from '@/utils/format';

interface StationPreviewCardProps {
  station: Station;
  onDetails: () => void;
  onRoute: () => void;
  onReserve?: () => void;
  onSelect?: () => void;
}

export function StationPreviewCard({
  station,
  onDetails,
  onRoute,
  onReserve,
  onSelect,
}: StationPreviewCardProps) {
  const { colors, typeScale } = useAppTheme();

  return (
    <AppCard accessibilityLabel={`Detalhes de ${station.name || 'estação sem nome'}`}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={[typeScale.titleLarge, { color: colors.text }]}>
            {station.name || 'Estação sem nome'}
          </Text>
          <Text style={[styles.address, { color: colors.textMuted }]}>
            {formatDistance(station.distanceKm)}
            {station.address ? ` · ${station.address}` : ''}
          </Text>
        </View>
        <StationStatusBadge status={station.status} />
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Ionicons name="flash" size={18} color={colors.primary} />
          <Text style={[styles.summaryText, { color: colors.text }]}>
            {station.totalConnectors > 0
              ? `${station.availableConnectors}/${station.totalConnectors} livres`
              : 'Conectores não informados'}
          </Text>
        </View>
        {station.maximumPowerKw > 0 ? (
          <Text style={[styles.summaryText, { color: colors.text }]}>
            até {station.maximumPowerKw} kW
          </Text>
        ) : null}
        {station.pricePerKwh > 0 ? (
          <Text style={[styles.summaryText, { color: colors.text }]}>
            {formatCurrency(station.pricePerKwh)}/kWh
          </Text>
        ) : (
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            Preço não informado
          </Text>
        )}
      </View>
      {station.plugTypes.length > 0 ? (
        <View style={styles.badges}>
          {station.plugTypes.map((plugType) => (
            <ConnectorBadge key={plugType} plugType={plugType} />
          ))}
        </View>
      ) : null}
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {station.operator || 'Operador não informado'}
        {station.rating > 0 ? ` · ★ ${station.rating.toFixed(1)}` : ''}
        {station.openingHours ? ` · ${station.openingHours}` : ''}
      </Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <OutlinedButton label="Detalhes" onPress={onDetails} />
        </View>
        <View style={styles.action}>
          <SecondaryButton label="Traçar rota" onPress={onRoute} />
        </View>
      </View>
      {onSelect ? (
        <PrimaryButton label="Selecionar estação" onPress={onSelect} />
      ) : onReserve ? (
        <PrimaryButton
          disabled={station.availableConnectors === 0}
          label="Reservar conector"
          onPress={onReserve}
        />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headingCopy: { flex: 1 },
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
