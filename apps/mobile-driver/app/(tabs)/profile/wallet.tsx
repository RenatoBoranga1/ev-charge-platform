import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import {
  WalletBalanceCard,
  WalletQuickActions,
  WalletTransactionItem,
} from '@/payments/WalletComponents';
import { paymentKeys } from '@/payments/query-keys';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function WalletScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const userId = user?.id ?? 'anonymous';
  const wallet = useQuery({
    queryKey: paymentKeys.wallet(userId),
    queryFn: () => api.payments.getWallet(),
    enabled: Boolean(user),
  });
  const transactions = useQuery({
    queryKey: paymentKeys.transactions(userId),
    queryFn: () => api.payments.listWalletTransactions(),
    enabled: Boolean(user),
  });

  if (wallet.isLoading) {
    return <Screen><LoadingState title="Carregando sua carteira" /></Screen>;
  }
  if (wallet.isError) {
    return (
      <Screen>
        <ErrorState
          actionLabel="Tentar novamente"
          message={wallet.error.message}
          onAction={() => void wallet.refetch()}
          title="Não foi possível carregar a carteira"
        />
      </Screen>
    );
  }
  if (!wallet.data) return null;

  return (
    <Screen>
      <AppHeader canGoBack title="Carteira Solis" subtitle="Saldo protegido e pagamentos rastreáveis" />
      <WalletBalanceCard
        wallet={wallet.data}
        onAddFunds={() => router.push('/(tabs)/profile/add-funds' as never)}
      />
      <WalletQuickActions
        onAutoRecharge={() => router.push('/(tabs)/profile/auto-recharge' as never)}
        onPaymentMethods={() => router.push('/(tabs)/profile/payment-center' as never)}
      />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Movimentações
      </Text>
      {transactions.isLoading ? (
        <LoadingState title="Carregando movimentações" />
      ) : transactions.isError ? (
        <ErrorState
          actionLabel="Tentar novamente"
          message={transactions.error.message}
          onAction={() => void transactions.refetch()}
          title="Não foi possível carregar as movimentações"
        />
      ) : transactions.data?.items.length ? (
        <AppCard>
          {transactions.data.items.map((item) => (
            <WalletTransactionItem
              item={item}
              key={item.id}
              {...(item.chargingSessionId
                ? {
                    onPress: () =>
                      router.push({
                        pathname: '/(tabs)/profile/receipt-[sessionId]' as never,
                        params: { sessionId: item.chargingSessionId },
                      }),
                  }
                : {})}
            />
          ))}
        </AppCard>
      ) : (
        <EmptyState
          message="Suas recargas, reservas e estornos aparecerão aqui."
          title="Nenhuma movimentação"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '900', marginTop: 8 },
});
