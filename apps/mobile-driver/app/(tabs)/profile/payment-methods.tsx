import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { PaymentMethodCard } from '@/components/PaymentMethodCard';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function PaymentMethodsScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.payments.list(),
  });
  const defaultMutation = useMutation({
    mutationFn: (id: string) => api.payments.setDefault(id),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['payment-methods'] }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => api.payments.remove(id),
    onSuccess: async () => {
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
  const pixMutation = useMutation({
    mutationFn: () => api.payments.createMockPix(50),
    onSuccess: (pix) =>
      Alert.alert('Pix mock gerado', pix.code + '\nExpira em ' + pix.expiresAt),
  });

  if (query.isLoading) return <Screen><LoadingState title="Carregando pagamentos" /></Screen>;
  if (query.isError) return <Screen><ErrorState title="Não foi possível carregar pagamentos" /></Screen>;

  return (
    <Screen>
      <AppHeader canGoBack title="Formas de pagamento" />
      <Text style={[styles.security, { color: colors.textMuted }]}>
        A Solis armazena apenas tokens e dados mascarados. Número completo e CVV nunca são salvos.
      </Text>
      {query.data?.length ? (
        query.data.map((method) => (
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
            loading={defaultMutation.isPending}
            onPress={() => defaultMutation.mutate(selectedId)}
          />
          <AppButton
            label="Remover método"
            variant="danger"
            loading={removeMutation.isPending}
            onPress={() => removeMutation.mutate(selectedId)}
          />
        </AppCard>
      ) : null}
      <AppButton
        label="Adicionar cartão tokenizado"
        variant="outline"
        onPress={() =>
          Alert.alert('Cartão mock', 'A tokenização real será feita pelo gateway, fora do aplicativo.')
        }
      />
      <AppButton
        label="Gerar Pix mock de R$ 50"
        variant="secondary"
        loading={pixMutation.isPending}
        onPress={() => pixMutation.mutate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  security: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
