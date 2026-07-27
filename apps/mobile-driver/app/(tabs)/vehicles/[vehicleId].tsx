import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Screen } from '@/components/Screen';
import { VehicleDetails } from '@/components/VehicleDetails';
import { useFeedback } from '@/design-system';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function VehicleDetailsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const query = useQuery({
    queryKey: ['vehicles', vehicleId],
    queryFn: () => api.vehicles.getById(vehicleId),
  });

  const setDefault = useMutation({
    mutationFn: () =>
      api.vehicles.setDefault(vehicleId, query.data?.recordVersion ?? 0),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      feedback.showSnackbar('Veículo principal atualizado.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });
  const duplicate = useMutation({
    mutationFn: () =>
      api.vehicles.duplicate(vehicleId, query.data?.recordVersion ?? 0),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      feedback.showSnackbar('Veículo duplicado.');
      router.push({
        pathname: '/(tabs)/vehicles/[vehicleId]',
        params: { vehicleId: created.id },
      });
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });
  const remove = useMutation({
    mutationFn: () =>
      api.vehicles.remove(vehicleId, query.data?.recordVersion ?? 0),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      feedback.showSnackbar('Veículo removido da garagem.');
      router.replace('/(tabs)/vehicles');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  if (query.isLoading) {
    return <Screen><LoadingState title="Carregando veículo" /></Screen>;
  }
  if (query.isError) {
    return (
      <Screen>
        <AppHeader canGoBack title="Veículo" />
        <ErrorState
          actionLabel="Tentar novamente"
          message={query.error.message}
          onAction={() => void query.refetch()}
          title="Não foi possível carregar o veículo"
        />
      </Screen>
    );
  }
  if (!query.data) {
    return (
      <Screen>
        <AppHeader canGoBack title="Veículo" />
        <EmptyState title="Veículo não encontrado" />
      </Screen>
    );
  }

  const vehicle = query.data;
  return (
    <Screen>
      <AppHeader
        canGoBack
        title={vehicle.nickname}
        subtitle={`${vehicle.brand} ${vehicle.model}`}
      />
      <VehicleDetails vehicle={vehicle} />
      <View style={{ gap: 10 }}>
        <AppButton
          label="Editar veículo"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/vehicles/edit-[vehicleId]',
              params: { vehicleId },
            })
          }
        />
        {!vehicle.isDefault ? (
          <AppButton
            label="Definir como principal"
            loading={setDefault.isPending}
            onPress={() => setDefault.mutate()}
            variant="secondary"
          />
        ) : null}
        <AppButton
          label="Duplicar veículo"
          loading={duplicate.isPending}
          onPress={() => duplicate.mutate()}
          variant="outline"
        />
        <AppButton
          label="Remover veículo"
          onPress={() => setDeleteVisible(true)}
          variant="danger"
        />
      </View>
      {(setDefault.error || duplicate.error || remove.error) ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {(setDefault.error ?? duplicate.error ?? remove.error)?.message}
        </Text>
      ) : null}
      <ConfirmationDialog
        confirmLabel="Remover"
        loading={remove.isPending}
        message={
          vehicle.isDefault
            ? 'Ao remover o principal, outro veículo ativo será promovido automaticamente.'
            : 'O veículo deixará de aparecer na garagem. O histórico será preservado.'
        }
        onCancel={() => setDeleteVisible(false)}
        onConfirm={() => remove.mutate()}
        title="Remover veículo?"
        visible={deleteVisible}
      />
    </Screen>
  );
}
