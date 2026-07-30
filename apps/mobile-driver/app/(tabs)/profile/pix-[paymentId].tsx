import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/design-system';
import { paymentKeys } from '@/payments/query-keys';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { PaymentIntentStatus } from '@/types/domain';
import { formatDateTime, formatMinorMoney } from '@/utils/format';

const labels: Record<PaymentIntentStatus, string> = {
  CREATED: 'Criado',
  PENDING: 'Aguardando pagamento',
  REQUIRES_ACTION: 'Ação necessária',
  AUTHORIZED: 'Autorizado',
  PROCESSING: 'Processando',
  CAPTURED: 'Pagamento confirmado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
  FAILED: 'Falhou',
  REQUIRES_REVIEW: 'Em análise',
  REFUNDED: 'Estornado',
  PARTIALLY_REFUNDED: 'Parcialmente estornado',
};

export default function PixPaymentScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const { user } = useAuth();
  const feedback = useFeedback();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 'anonymous';
  const payment = useQuery({
    queryKey: paymentKeys.intent(userId, paymentId),
    queryFn: () => api.payments.getTopUp(paymentId),
    enabled: Boolean(paymentId && user),
    refetchInterval: (query) => (query.state.data?.isTerminal ? false : 2500),
    refetchIntervalInBackground: false,
  });
  const cancel = useMutation({
    mutationFn: () => api.payments.cancelPayment(paymentId),
    onSuccess: (updated) => {
      queryClient.setQueryData(paymentKeys.intent(userId, paymentId), updated);
      feedback.showSnackbar('Pagamento cancelado.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  useEffect(() => {
    if (payment.data?.status !== 'CAPTURED') return;
    void queryClient.invalidateQueries({ queryKey: paymentKeys.wallet(userId) });
  }, [payment.data?.status, queryClient, userId]);

  if (payment.isLoading) return <Screen><LoadingState title="Carregando Pix" /></Screen>;
  if (payment.isError) {
    return (
      <Screen>
        <ErrorState
          actionLabel="Tentar novamente"
          message={payment.error.message}
          onAction={() => void payment.refetch()}
          title="Não foi possível consultar o Pix"
        />
      </Screen>
    );
  }
  if (!payment.data) return null;
  const intent = payment.data;
  const copyCode = intent.metadata?.copyPasteCode;

  return (
    <Screen>
      <AppHeader canGoBack title="Pagamento Pix" />
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="summary"
        style={[styles.status, { backgroundColor: colors.primaryContainer }]}
      >
        <Text style={[styles.statusLabel, { color: colors.onPrimaryContainer }]}>
          {labels[intent.status]}
        </Text>
        <Text style={[styles.amount, { color: colors.onPrimaryContainer }]}>
          {formatMinorMoney(intent.amountMinor, intent.currency)}
        </Text>
      </View>
      {copyCode && !intent.isTerminal ? (
        <AppCard>
          <Text style={[styles.instructions, { color: colors.text }]}>
            Copie o código e pague no aplicativo do seu banco.
          </Text>
          <Text
            accessibilityLabel="Código Pix copia e cola"
            numberOfLines={4}
            selectable
            style={[styles.code, { color: colors.text, borderColor: colors.border }]}
          >
            {copyCode}
          </Text>
          <AppButton
            label="Copiar código Pix"
            onPress={() => {
              void Clipboard.setStringAsync(copyCode).then(() =>
                feedback.showSnackbar('Código Pix copiado.'),
              );
            }}
          />
        </AppCard>
      ) : null}
      <AppCard>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          Criado em {formatDateTime(intent.createdAt)}
        </Text>
        {intent.expiresAt ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            Expira em {formatDateTime(intent.expiresAt)}
          </Text>
        ) : null}
        {!intent.isTerminal ? (
          <Text style={[styles.polling, { color: colors.primary }]}>
            Atualizando automaticamente…
          </Text>
        ) : null}
      </AppCard>
      {intent.status === 'CAPTURED' ? (
        <AppButton label="Ver carteira" onPress={() => router.replace('/(tabs)/profile/wallet' as never)} />
      ) : null}
      {intent.status === 'PENDING' || intent.status === 'REQUIRES_ACTION' ? (
        <AppButton
          label="Cancelar pagamento"
          loading={cancel.isPending}
          onPress={() => cancel.mutate()}
          variant="outline"
        />
      ) : null}
      {intent.status === 'FAILED' || intent.status === 'EXPIRED' ? (
        <AppButton label="Tentar novamente" onPress={() => router.replace('/(tabs)/profile/add-funds' as never)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: 'center', borderRadius: 24, padding: 24 },
  statusLabel: { fontSize: 16, fontWeight: '800' },
  amount: { fontSize: 32, fontWeight: '900', marginTop: 8 },
  instructions: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  code: { borderRadius: 10, borderWidth: 1, fontSize: 12, lineHeight: 18, padding: 12 },
  detail: { fontSize: 13, lineHeight: 20 },
  polling: { fontSize: 13, fontWeight: '800', marginTop: 8 },
});
