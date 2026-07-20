import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import type { StationStatus } from '@/types/domain';

const labels: Record<StationStatus, string> = {
  AVAILABLE: 'Disponível',
  PARTIAL: 'Parcialmente ocupada',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  OFFLINE: 'Offline',
  MAINTENANCE: 'Em manutenção',
};

const icons: Record<StationStatus, keyof typeof Ionicons.glyphMap> = {
  AVAILABLE: 'checkmark-circle',
  PARTIAL: 'time',
  OCCUPIED: 'remove-circle',
  RESERVED: 'calendar',
  OFFLINE: 'cloud-offline',
  MAINTENANCE: 'construct',
};

export function StationStatusBadge({ status }: { status: StationStatus }) {
  const { colors, radii } = useAppTheme();
  const statusColor =
    status === 'AVAILABLE'
      ? colors.success
      : status === 'PARTIAL' || status === 'RESERVED'
        ? colors.warning
        : status === 'OFFLINE' || status === 'MAINTENANCE'
          ? colors.textMuted
          : colors.danger;

  return (
    <View
      accessibilityLabel={`Status: ${labels[status]}`}
      style={[
        styles.badge,
        {
          borderColor: statusColor,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Ionicons name={icons[status]} color={statusColor} size={15} />
      <Text style={[styles.label, { color: statusColor }]}>{labels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  label: { fontSize: 12, fontWeight: '800' },
});
