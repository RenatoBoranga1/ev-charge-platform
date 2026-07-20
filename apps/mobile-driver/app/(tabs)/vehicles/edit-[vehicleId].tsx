import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { api } from '@/api';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { VehicleForm } from '@/components/VehicleForm';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Vehicle } from '@/types/domain';

type VehicleInput = Omit<Vehicle, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export default function EditVehicleScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.vehicles.list(),
  });
  const vehicle = query.data?.find((item) => item.id === vehicleId);
  const mutation = useMutation({
    mutationFn: (input: VehicleInput) => api.vehicles.update(vehicleId, input),
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
