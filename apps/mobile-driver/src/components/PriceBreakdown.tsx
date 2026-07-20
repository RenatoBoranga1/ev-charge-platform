import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import type { PriceBreakdown as PriceBreakdownType } from '@/types/domain';
import { formatCurrency } from '@/utils/format';

export function PriceBreakdown({ price }: { price: PriceBreakdownType }) {
  const { colors } = useAppTheme();
  const rows = [
    ['Energia', price.energyAmount],
    ['Ativação', price.activationFee],
    ['Estacionamento', price.parkingFee],
    ['Descontos', -price.discountAmount],
    ['Impostos', price.taxAmount],
  ] as const;

  return (
    <View>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatCurrency(value)}
          </Text>
        </View>
      ))}
      <View style={[styles.total, { borderTopColor: colors.border }]}>
        <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
        <Text style={[styles.totalValue, { color: colors.primary }]}>
          {formatCurrency(price.totalAmount)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '700' },
  total: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 18, fontWeight: '900' },
  totalValue: { fontSize: 20, fontWeight: '900' },
});
