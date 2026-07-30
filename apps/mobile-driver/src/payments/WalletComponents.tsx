import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Wallet, WalletTransaction } from '@/types/domain';
import { formatDateTime, formatMinorMoney } from '@/utils/format';

export function WalletBalanceCard({
  wallet,
  onAddFunds,
}: {
  wallet: Wallet;
  onAddFunds: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <AppCard
      accessibilityLabel={`Saldo disponível ${formatMinorMoney(
        wallet.availableBalanceMinor,
        wallet.currency,
      )}`}
      style={{ backgroundColor: colors.primaryContainer }}
    >
      <View style={styles.balanceHeading}>
        <Ionicons name="wallet-outline" size={24} color={colors.primary} />
        <Text style={[styles.balanceLabel, { color: colors.onPrimaryContainer }]}>
          Saldo disponível
        </Text>
      </View>
      <Text style={[styles.balance, { color: colors.onPrimaryContainer }]}>
        {formatMinorMoney(wallet.availableBalanceMinor, wallet.currency)}
      </Text>
      {wallet.reservedBalanceMinor !== '0' ? (
        <Text style={[styles.reserved, { color: colors.onPrimaryContainer }]}>
          {formatMinorMoney(wallet.reservedBalanceMinor, wallet.currency)} reservado
        </Text>
      ) : null}
      <AppButton label="Adicionar saldo" onPress={onAddFunds} />
    </AppCard>
  );
}

export function WalletQuickActions({
  onAutoRecharge,
  onPaymentMethods,
}: {
  onAutoRecharge: () => void;
  onPaymentMethods: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.actions}>
      <QuickAction
        icon="refresh-circle-outline"
        label="Recarga automática"
        color={colors.primary}
        onPress={onAutoRecharge}
      />
      <QuickAction
        icon="card-outline"
        label="Métodos"
        color={colors.primary}
        onPress={onPaymentMethods}
      />
    </View>
  );
}

function QuickAction({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function WalletTransactionItem({
  item,
  onPress,
}: {
  item: WalletTransaction;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const isCredit = item.direction === 'CREDIT';
  const content = (
    <View
      accessibilityLabel={`${item.description}, ${isCredit ? 'crédito' : 'débito'} de ${formatMinorMoney(
        item.amountMinor,
        item.currency,
      )}`}
      style={[styles.transaction, { borderBottomColor: colors.border }]}
    >
      <View
        style={[
          styles.transactionIcon,
          { backgroundColor: colors.primaryContainer },
        ]}
      >
        <Ionicons
          name={isCredit ? 'arrow-down' : 'arrow-up'}
          size={18}
          color={isCredit ? colors.success : colors.primary}
        />
      </View>
      <View style={styles.transactionCopy}>
        <Text style={[styles.transactionTitle, { color: colors.text }]}>{item.description}</Text>
        <Text style={[styles.transactionDate, { color: colors.textMuted }]}>
          {formatDateTime(item.createdAt)}
        </Text>
      </View>
      <Text style={[styles.transactionAmount, { color: isCredit ? colors.success : colors.text }]}>
        {isCredit ? '+' : '-'} {formatMinorMoney(item.amountMinor, item.currency)}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityHint="Abre o recibo da sessão"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  balanceHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  balanceLabel: { fontSize: 14, fontWeight: '700' },
  balance: { fontSize: 35, fontWeight: '900', marginVertical: 12 },
  reserved: { fontSize: 13, marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 8,
    minHeight: 86,
    justifyContent: 'center',
    padding: 12,
  },
  actionLabel: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  transaction: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 72,
  },
  transactionIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  transactionCopy: { flex: 1 },
  transactionTitle: { fontSize: 14, fontWeight: '800' },
  transactionDate: { fontSize: 12, marginTop: 4 },
  transactionAmount: { fontSize: 14, fontWeight: '900' },
});
