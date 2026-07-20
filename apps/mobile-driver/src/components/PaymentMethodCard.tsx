import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from './AppCard';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { PaymentMethod } from '@/types/domain';
import { formatCurrency } from '@/utils/format';

export function PaymentMethodCard({
  method,
  selected = false,
  onPress,
}: {
  method: PaymentMethod;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const icon =
    method.type === 'CREDIT_CARD'
      ? 'card-outline'
      : method.type === 'PIX'
        ? 'qr-code-outline'
        : method.type === 'WALLET'
          ? 'wallet-outline'
          : 'pricetag-outline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <AppCard
        style={{
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        }}
      >
        <View style={styles.row}>
          <Ionicons name={icon} size={25} color={colors.primary} />
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>{method.label}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {method.lastFour
                ? `${method.brand ?? 'Cartão'} •••• ${method.lastFour} · ${method.expiry}`
                : method.balance !== undefined
                  ? `Saldo de ${formatCurrency(method.balance)}`
                  : 'Disponível para esta recarga'}
            </Text>
          </View>
          {method.isDefault ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          ) : null}
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 },
  label: { fontSize: 16, fontWeight: '800' },
  meta: { marginTop: 4, fontSize: 13 },
});
