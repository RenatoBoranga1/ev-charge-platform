import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { api } from '@/api';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { VehicleForm } from '@/components/VehicleForm';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { VehicleCreateInput } from '@/types/domain';

export default function EditVehicleScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['vehicles', vehicleId],
    queryFn: () => api.vehicles.getById(vehicleId),
  });
  const vehicle = query.data;
  const mutation = useMutation({
    mutationFn: (input: VehicleCreateInput) =>
      api.vehicles.update(vehicleId, {
        ...input,
        recordVersion: vehicle?.recordVersion ?? 0,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      router.back();
    },
  });

  if (query.isLoading) {
    return <Screen><LoadingState title="Carregando veículo" /></Screen>;
  }
  if (!vehicle) {
    return <Screen><EmptyState title="Veículo não encontrado" /></Screen>;
  }

  return (
    <Screen>
      <AppHeader canGoBack title="Editar veículo" />
      <VehicleForm
        initial={vehicle}
        loading={mutation.isPending}
        submitLabel="Salvar alterações"
        onSubmit={(input) => mutation.mutate(input)}
      />
      {mutation.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {mutation.error.message}
        </Text>
      ) : null}
    </Screen>
  );
}
