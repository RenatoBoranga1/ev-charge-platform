import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

export function ChargingProgress({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const { colors, radii } = useAppTheme();
  const bounded = Math.max(0, Math.min(100, percent));

  return (
    <View accessible accessibilityLabel={`${label}: ${bounded.toFixed(0)} por cento`}>
      <View
        style={[
          styles.track,
          { backgroundColor: colors.border, borderRadius: radii.pill },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${bounded}%`,
              backgroundColor: colors.primary,
              borderRadius: radii.pill,
            },
          ]}
        />
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>
        {label} · {bounded.toFixed(0)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 12, overflow: 'hidden' },
  fill: { height: '100%' },
  label: { marginTop: 8, fontSize: 13, fontWeight: '700' },
});
