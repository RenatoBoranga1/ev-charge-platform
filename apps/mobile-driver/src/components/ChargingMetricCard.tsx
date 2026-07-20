import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from './AppCard';
import { useAppTheme } from '@/theme/ThemeProvider';

export function ChargingMetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  const { colors } = useAppTheme();

  return (
    <AppCard style={styles.card}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.value, { color: colors.text }]}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 140 },
  label: { fontSize: 13, fontWeight: '700' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 8 },
  value: { fontSize: 26, fontWeight: '900' },
  unit: { fontSize: 13, fontWeight: '700' },
});
