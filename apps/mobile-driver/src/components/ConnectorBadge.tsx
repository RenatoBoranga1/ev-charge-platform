import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import type { PlugType } from '@/types/domain';

export function ConnectorBadge({
  plugType,
  powerKw,
}: {
  plugType: PlugType;
  powerKw?: number;
}) {
  const { colors, radii } = useAppTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.elevatedSurface,
          borderColor: colors.border,
          borderRadius: radii.pill,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.text }]}>
        {plugType.replace('_', ' ')}
        {powerKw ? ` · ${powerKw} kW` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 30,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  label: { fontSize: 12, fontWeight: '700' },
});
