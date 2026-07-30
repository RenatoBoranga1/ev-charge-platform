import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { PaymentMethodCard } from '@/components/PaymentMethodCard';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/design-system';
import { paymentKeys } from '@/payments/query-keys';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function PaymentCenterScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 'anonymous';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const methods = useQuery({
    queryKey: paymentKeys.methods(userId),
    queryFn: () => api.payments.list(),
    enabled: Boolean(user),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: paymentKeys.methods(userId) });
  const setDefault = useMutation({
    mutationFn: (id: string) => api.payments.setDefault(id),
    onSuccess: async () => {
      await refresh();
      feedback.showSnackbar('Método principal atualizado.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.payments.remove(id),
    onSuccess: async () => {
      setSelectedId(null);
      await refresh();
      feedback.showSnackbar('Método removido.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });
  const create = useMutation({
    mutationFn: () =>
      api.payments.createMethod({
        brand: 'Visa',
        expirationMonth: 12,
        expirationYear: new Date().getUTCFullYear() + 3,
        isDefault: !methods.data?.length,
        lastFour: '4242',
        type: 'CARD',
      }),
    onSuccess: async () => {
      await refresh();
      feedback.showSnackbar('Cartão tokenizado adicionado.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  if (methods.isLoading) return <Screen><LoadingState title="Carregando pagamentos" /></Screen>;
  if (methods.isError) {
    return (
      <Screen>
        <ErrorState
          actionLabel="Tentar novamente"
          message={methods.error.message}
          onAction={() => void methods.refetch()}
          title="Não foi possível carregar pagamentos"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader canGoBack title="Formas de pagamento" />
      <Text style={[styles.security, { color: colors.textMuted }]}>
        A Solis armazena apenas tokens e dados mascarados. Número completo e CVV nunca são salvos.
      </Text>
      {methods.data?.length ? (
        methods.data.map((method) => (
          <PaymentMethodCard
            key={method.id}
            method={method}
            selected={selectedId === method.id}
            onPress={() => setSelectedId(method.id)}
          />
        ))
      ) : (
        <EmptyState title="Nenhuma forma de pagamento" />
      )}
      {selectedId ? (
        <AppCard>
          <AppButton
            label="Definir como principal"
            loading={setDefault.isPending}
            onPress={() => setDefault.mutate(selectedId)}
          />
          <AppButton
            label="Remover método"
            loading={remove.isPending}
            onPress={() => remove.mutate(selectedId)}
            variant="danger"
          />
        </AppCard>
      ) : null}
      <AppButton
        label="Adicionar cartão tokenizado de demonstração"
        loading={create.isPending}
        onPress={() => create.mutate()}
        variant="outline"
      />
      <AppButton
        label="Adicionar saldo via Pix"
        onPress={() => router.push('/(tabs)/profile/add-funds' as never)}
        variant="secondary"
      />
      <Text style={[styles.security, { color: colors.textMuted }]}>
        O cartão de demonstração só pode ser criado quando o backend usa PAYMENTS_MODE=mock.
        Em produção, a tokenização será feita pelo SDK do provedor.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  security: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
});
