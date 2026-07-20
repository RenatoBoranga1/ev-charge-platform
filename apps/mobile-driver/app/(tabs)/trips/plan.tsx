import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { VehicleCard } from '@/components/VehicleCard';
import { useRoutePlannerStore } from '@/stores/route-planner-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { RoutePlannerInput } from '@/types/domain';

const schema = z.object({
  origin: z.string().min(3, 'Informe a origem.'),
  destination: z.string().min(3, 'Informe o destino.'),
  vehicleId: z.string().min(1, 'Selecione um veículo.'),
  currentBatteryPercent: z.number().min(5).max(100),
  minimumArrivalBatteryPercent: z.number().min(5).max(50),
  preferFastChargers: z.boolean(),
  avoidTolls: z.boolean(),
  avoidOfflineStations: z.boolean(),
  priority: z.enum(['LOWEST_COST', 'SHORTEST_TIME']),
});

export default function PlanTripScreen() {
  const params = useLocalSearchParams<{ destination?: string }>();
  const { colors } = useAppTheme();
  const setResult = useRoutePlannerStore((state) => state.setResult);
  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.vehicles.list(),
  });
  const defaultVehicle = vehicles.data?.find((vehicle) => vehicle.isDefault);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RoutePlannerInput>({
    resolver: zodResolver(schema),
    values: {
      origin: 'Minha localização',
      destination: params.destination ?? '',
      vehicleId: defaultVehicle?.id ?? '',
      currentBatteryPercent: 72,
      minimumArrivalBatteryPercent: 15,
      preferFastChargers: true,
      avoidTolls: false,
      avoidOfflineStations: true,
      priority: 'SHORTEST_TIME',
    },
  });
  const selectedVehicleId = useWatch({ control, name: 'vehicleId' });
  const priority = useWatch({ control, name: 'priority' });
  const mutation = useMutation({
    mutationFn: (input: RoutePlannerInput) => api.routePlanner.calculateRoute(input),
    onSuccess: (result) => {
      setResult(result);
      router.push('/(tabs)/trips/result');
    },
  });

  return (
    <Screen>
      <AppHeader canGoBack title="Planejar viagem" />
      <View style={styles.form}>
        <Controller
          control={control}
          name="origin"
          render={({ field }) => (
            <AppTextField
              label="Origem"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.origin?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="destination"
          render={({ field }) => (
            <AppTextField
              label="Destino"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.destination?.message}
            />
          )}
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Veículo</Text>
        {vehicles.data?.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            selected={selectedVehicleId === vehicle.id}
            onPress={() => setValue('vehicleId', vehicle.id)}
          />
        ))}
        {errors.vehicleId ? (
          <Text style={{ color: colors.danger }}>{errors.vehicleId.message}</Text>
        ) : null}
        <Controller
          control={control}
          name="currentBatteryPercent"
          render={({ field }) => (
            <AppTextField
              keyboardType="number-pad"
              label="Bateria atual (%)"
              value={String(field.value)}
              onChangeText={(value) => field.onChange(Number(value))}
              error={errors.currentBatteryPercent?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="minimumArrivalBatteryPercent"
          render={({ field }) => (
            <AppTextField
              keyboardType="number-pad"
              label="Reserva mínima na chegada (%)"
              value={String(field.value)}
              onChangeText={(value) => field.onChange(Number(value))}
              error={errors.minimumArrivalBatteryPercent?.message}
            />
          )}
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Prioridade</Text>
        <View style={styles.chips}>
          <FilterChip
            label="Menor tempo"
            selected={priority === 'SHORTEST_TIME'}
            onPress={() => setValue('priority', 'SHORTEST_TIME')}
          />
          <FilterChip
            label="Menor custo"
            selected={priority === 'LOWEST_COST'}
            onPress={() => setValue('priority', 'LOWEST_COST')}
          />
        </View>
        <Controller
          control={control}
          name="preferFastChargers"
          render={({ field }) => (
            <Toggle label="Priorizar carregadores rápidos" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="avoidTolls"
          render={({ field }) => (
            <Toggle label="Evitar pedágios" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="avoidOfflineStations"
          render={({ field }) => (
            <Toggle label="Ignorar estações fora de operação" value={field.value} onChange={field.onChange} />
          )}
        />
        {mutation.error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {mutation.error.message}
          </Text>
        ) : null}
        <AppButton
          label="Calcular rota"
          loading={mutation.isPending}
          onPress={handleSubmit((input) => mutation.mutate(input))}
        />
      </View>
    </Screen>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.toggle, { borderBottomColor: colors.border }]}>
      <Text style={[styles.toggleText, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  toggleText: { flex: 1, fontSize: 15, fontWeight: '600' },
});
