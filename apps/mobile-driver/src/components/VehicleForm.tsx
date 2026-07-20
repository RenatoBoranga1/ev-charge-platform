import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from './AppButton';
import { AppTextField } from './AppTextField';
import { FilterChip } from './FilterChip';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { PlugType, Vehicle } from '@/types/domain';

const vehicleSchema = z.object({
  brand: z.string().min(2, 'Informe o fabricante.'),
  model: z.string().min(1, 'Informe o modelo.'),
  version: z.string(),
  year: z.number().int().min(1990).max(2100),
  vehicleType: z.enum(['BEV', 'PHEV']),
  batteryCapacityKwh: z.number().positive().max(250),
  estimatedRangeKm: z.number().positive().max(1500),
  licensePlate: z.string().max(10),
  supportedPlugTypes: z.array(z.enum(['CCS2', 'TYPE_2', 'CHADEMO', 'GB_T'])).min(1),
  isDefault: z.boolean(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;
type VehicleInput = Omit<Vehicle, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

interface VehicleFormProps {
  initial?: Vehicle;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (vehicle: VehicleInput) => void;
}

const popularVehicles = [
  { brand: 'Aurora', model: 'E1 Touring', battery: 64, range: 430 },
  { brand: 'Horizonte', model: 'P2', battery: 18.3, range: 82 },
  { brand: 'Nexo', model: 'Urban EV', battery: 48, range: 335 },
] as const;

export function VehicleForm({
  initial,
  submitLabel,
  loading = false,
  onSubmit,
}: VehicleFormProps) {
  const { colors } = useAppTheme();
  const [step, setStep] = useState(0);
  const {
    control,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      brand: initial?.brand ?? '',
      model: initial?.model ?? '',
      version: initial?.version ?? '',
      year: initial?.year ?? 2026,
      vehicleType: initial?.vehicleType ?? 'BEV',
      batteryCapacityKwh: initial?.batteryCapacityKwh ?? 60,
      estimatedRangeKm: initial?.estimatedRangeKm ?? 400,
      licensePlate: initial?.licensePlate ?? '',
      supportedPlugTypes: initial?.supportedPlugTypes ?? ['CCS2', 'TYPE_2'],
      isDefault: initial?.isDefault ?? false,
    },
  });

  const vehicleType = useWatch({ control, name: 'vehicleType' });
  const supportedPlugTypes = useWatch({ control, name: 'supportedPlugTypes' });
  async function next() {
    const fields =
      step === 0
        ? (['brand', 'model', 'version', 'year'] as const)
        : (['vehicleType', 'batteryCapacityKwh', 'estimatedRangeKm'] as const);
    if (await trigger(fields)) setStep((current) => Math.min(2, current + 1));
  }

  function choosePopular(vehicle: (typeof popularVehicles)[number]) {
    setValue('brand', vehicle.brand);
    setValue('model', vehicle.model);
    setValue('batteryCapacityKwh', vehicle.battery);
    setValue('estimatedRangeKm', vehicle.range);
  }

  function submit(values: VehicleFormValues) {
    const input: VehicleInput = {
      brand: values.brand,
      model: values.model,
      year: values.year,
      vehicleType: values.vehicleType,
      batteryCapacityKwh: values.batteryCapacityKwh,
      estimatedRangeKm: values.estimatedRangeKm,
      supportedPlugTypes: values.supportedPlugTypes,
      isDefault: values.isDefault,
    };
    if (values.version.trim()) input.version = values.version.trim();
    if (values.licensePlate.trim()) input.licensePlate = values.licensePlate.trim();
    onSubmit(input);
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.stepLabel, { color: colors.primary }]}>
        Etapa {step + 1} de 3
      </Text>

      {step === 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Comece por um modelo popular
          </Text>
          <View style={styles.chips}>
            {popularVehicles.map((vehicle) => (
              <FilterChip
                key={vehicle.brand + vehicle.model}
                label={vehicle.brand + ' ' + vehicle.model}
                onPress={() => choosePopular(vehicle)}
              />
            ))}
          </View>
          <Text style={[styles.manual, { color: colors.textMuted }]}>
            Não encontrou? Cadastre seu veículo manualmente.
          </Text>
          <Controller
            control={control}
            name="brand"
            render={({ field }) => (
              <AppTextField
                label="Fabricante"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.brand?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="model"
            render={({ field }) => (
              <AppTextField
                label="Modelo"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.model?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="version"
            render={({ field }) => (
              <AppTextField
                label="Versão"
                value={field.value}
                onChangeText={(value) => field.onChange(Number(value))}
                error={errors.version?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="year"
            render={({ field }) => (
              <AppTextField
                keyboardType="number-pad"
                label="Ano"
                value={String(field.value)}
                onChangeText={field.onChange}
                error={errors.year?.message}
              />
            )}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Energia e autonomia
          </Text>
          <View style={styles.chips}>
            <FilterChip
              label="Elétrico"
              selected={vehicleType === 'BEV'}
              onPress={() => setValue('vehicleType', 'BEV')}
            />
            <FilterChip
              label="Híbrido plug-in"
              selected={vehicleType === 'PHEV'}
              onPress={() => setValue('vehicleType', 'PHEV')}
            />
          </View>
          <Controller
            control={control}
            name="batteryCapacityKwh"
            render={({ field }) => (
              <AppTextField
                keyboardType="decimal-pad"
                label="Capacidade da bateria (kWh)"
                value={String(field.value)}
                onChangeText={(value) => field.onChange(Number(value))}
                error={errors.batteryCapacityKwh?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="estimatedRangeKm"
            render={({ field }) => (
              <AppTextField
                keyboardType="number-pad"
                label="Autonomia estimada (km)"
                value={String(field.value)}
                onChangeText={(value) => field.onChange(Number(value))}
                error={errors.estimatedRangeKm?.message}
              />
            )}
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Compatibilidade e preferência
          </Text>
          <View style={styles.chips}>
            {(['CCS2', 'TYPE_2', 'CHADEMO', 'GB_T'] as PlugType[]).map((plug) => {
              const selected = supportedPlugTypes.includes(plug);
              return (
                <FilterChip
                  key={plug}
                  label={plug.replace('_', ' ')}
                  selected={selected}
                  onPress={() =>
                    setValue(
                      'supportedPlugTypes',
                      selected
                        ? supportedPlugTypes.filter((item) => item !== plug)
                        : [...supportedPlugTypes, plug],
                    )
                  }
                />
              );
            })}
          </View>
          {errors.supportedPlugTypes ? (
            <Text style={{ color: colors.danger }}>
              {errors.supportedPlugTypes.message}
            </Text>
          ) : null}
          <Controller
            control={control}
            name="licensePlate"
            render={({ field }) => (
              <AppTextField
                autoCapitalize="characters"
                label="Placa opcional"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.licensePlate?.message}
                hint="A interface sempre exibe a placa mascarada."
              />
            )}
          />
          <Controller
            control={control}
            name="isDefault"
            render={({ field }) => (
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>
                  Definir como veículo principal
                </Text>
                <Switch
                  accessibilityLabel="Definir como veículo principal"
                  value={field.value}
                  onValueChange={field.onChange}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            )}
          />
        </>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <View style={styles.action}>
            <AppButton
              label="Voltar"
              variant="outline"
              onPress={() => setStep((current) => current - 1)}
            />
          </View>
        ) : null}
        <View style={styles.action}>
          {step < 2 ? (
            <AppButton label="Continuar" onPress={() => void next()} />
          ) : (
            <AppButton
              label={submitLabel}
              loading={loading}
              onPress={handleSubmit(submit)}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  stepLabel: { fontSize: 13, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  manual: { fontSize: 13 },
  switchRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: { flex: 1 },
});
