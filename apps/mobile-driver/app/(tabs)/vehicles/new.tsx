import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { api } from '@/api';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { VehicleForm } from '@/components/VehicleForm';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Vehicle } from '@/types/domain';

type VehicleInput = Omit<Vehicle, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export default function NewVehicleScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: VehicleInput) => api.vehicles.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      router.replace('/(tabs)/vehicles');
    },
  });

  return (
    <Screen>
      <AppHeader canGoBack title="Adicionar veículo" />
      <VehicleForm
        loading={mutation.isPending}
        submitLabel="Salvar veículo"
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
