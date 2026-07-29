import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import type { StationStatus } from '@/types/domain';

export interface StationMarkerVisual {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}

export function getStationMarkerVisual(status: StationStatus | 'UNKNOWN'): StationMarkerVisual {
  switch (status) {
    case 'AVAILABLE':
      return { icon: 'flash', label: 'Dispon\u00edvel', tone: 'success' };
    case 'PARTIAL':
      return {
        icon: 'time-outline',
        label: 'Parcialmente ocupada',
        tone: 'warning',
      };
    case 'OCCUPIED':
    case 'RESERVED':
      return {
        icon: 'close-circle-outline',
        label: 'Indispon\u00edvel',
        tone: 'danger',
      };
    case 'OFFLINE':
    case 'MAINTENANCE':
      return {
        icon: 'cloud-offline-outline',
        label: 'Offline',
        tone: 'neutral',
      };
    case 'UNKNOWN':
    default:
      return {
        icon: 'help-outline',
        label: 'Sem informa\u00e7\u00e3o',
        tone: 'neutral',
      };
  }
}

export function StationMapMarker({
  status,
  selected,
  availableConnectors = 0,
  totalConnectors = 0,
}: {
  status: StationStatus;
  selected: boolean;
  availableConnectors?: number;
  totalConnectors?: number;
}) {
  const { colors } = useAppTheme();
  const visual = getStationMarkerVisual(status);
  const color =
    status === 'AVAILABLE'
      ? colors.stationAvailable
      : status === 'PARTIAL' || status === 'OCCUPIED' || status === 'RESERVED'
        ? colors.stationBusy
        : colors.stationOffline;

  return (
    <View
      accessibilityLabel={`${visual.label}. ${availableConnectors} de ${totalConnectors} conectores dispon\u00edveis.`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.marker,
        {
          backgroundColor: color,
          borderColor: selected ? colors.focus : colors.surface,
          borderWidth: selected ? 4 : 3,
          transform: [{ scale: selected ? 1.12 : 1 }],
        },
      ]}
    >
      <Ionicons name={visual.icon} color={colors.onPrimary} size={18} />
      {totalConnectors > 0 ? (
        <View
          style={[
            styles.connectorCount,
            {
              backgroundColor: colors.surface,
              borderColor: color,
            },
          ]}
        >
          <Text style={[styles.connectorCountText, { color: colors.text }]}>
            {availableConnectors}
          </Text>
        </View>
      ) : null}
      <View style={[styles.pointer, { borderTopColor: color }]} />
    </View>
  );
}

export function StationClusterMarker({ count }: { count: number }) {
  const { colors, shadows } = useAppTheme();
  return (
    <View
      accessibilityLabel={`Agrupamento com ${count} esta\u00e7\u00f5es`}
      accessibilityRole="button"
      style={[
        styles.cluster,
        shadows.level2,
        {
          backgroundColor: colors.primaryContainer,
          borderColor: colors.primary,
        },
      ]}
    >
      <Ionicons name="location" color={colors.primary} size={18} />
      <Text style={[styles.clusterText, { color: colors.onPrimaryContainer }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorCount: {
    position: 'absolute',
    right: -8,
    top: -8,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorCountText: { fontSize: 11, fontWeight: '900' },
  pointer: {
    position: 'absolute',
    bottom: -9,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  cluster: {
    minWidth: 50,
    height: 50,
    paddingHorizontal: 9,
    borderRadius: 25,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  clusterText: { fontSize: 14, fontWeight: '900' },
});
