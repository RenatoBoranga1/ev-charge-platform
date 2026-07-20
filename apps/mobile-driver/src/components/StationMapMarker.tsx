import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import type { StationStatus } from '@/types/domain';

export function StationMapMarker({
  status,
  selected,
}: {
  status: StationStatus;
  selected: boolean;
}) {
  const { colors } = useAppTheme();
  const color =
    status === 'AVAILABLE'
      ? colors.success
      : status === 'PARTIAL' || status === 'RESERVED'
        ? colors.warning
        : status === 'OCCUPIED'
          ? colors.danger
          : colors.textMuted;

  return (
    <View
      style={[
        styles.marker,
        {
          backgroundColor: color,
          borderColor: selected ? colors.secondary : colors.surface,
          transform: [{ scale: selected ? 1.12 : 1 }],
        },
      ]}
    >
      <Ionicons name="flash" color="#FFFFFF" size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
