import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from './AppButton';
import { AppTextField } from './AppTextField';
import { FilterChip } from './FilterChip';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { PlugType, Vehicle, VehicleCreateInput } from '@/types/domain';

const vehicleSchema = z.object({
  brand: z.string().min(2, 'Informe o fabricante.'),
  nickname: z.string().min(2, 'Informe um apelido.').max(60),
  model: z.string().min(1, 'Informe o modelo.'),
  version: z.string(),
  year: z.number().int().min(1990).max(2100),
  vehicleType: z.enum(['BEV', 'PHEV', 'HEV']),
  batteryCapacityKwh: z.number().positive().max(250),
  estimatedRangeKm: z.number().positive().max(1500),
  licensePlate: z.string().max(10),
  averageConsumptionKwhPer100Km: z.number().positive().max(200),
  maximumAcPowerKw: z.number().positive().max(100),
  maximumDcPowerKw: z.number().positive().max(1000),
  color: z.string().max(40),
  vin: z.string().refine((value) => value === '' || /^[A-HJ-NPR-Z0-9]{17}$/i.test(value), 'Informe um VIN válido com 17 caracteres.'),
  imageUrl: z.string().refine((value) => value === '' || /^https?:\/\//i.test(value), 'Informe uma URL válida.'),
  supportedPlugTypes: z.array(z.enum(['CCS2', 'TYPE_2', 'CHADEMO', 'NACS', 'GB_T'])),
  isDefault: z.boolean(),
  notes: z.string().max(1000),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SOLD']),
}).superRefine((value, context) => {
  if (value.vehicleType !== 'HEV' && value.supportedPlugTypes.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'Selecione ao menos um conector.',
      path: ['supportedPlugTypes'],
    });
  }
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;
type VehicleInput = VehicleCreateInput;

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
      nickname: initial?.nickname ?? '',
      brand: initial?.brand ?? '',
      model: initial?.model ?? '',
      version: initial?.version ?? '',
      color: initial?.color ?? '',
      year: initial?.year ?? 2026,
      vehicleType: initial?.vehicleType ?? 'BEV',
      batteryCapacityKwh: initial?.batteryCapacityKwh ?? 60,
      estimatedRangeKm: initial?.estimatedRangeKm ?? 400,
      averageConsumptionKwhPer100Km: initial?.averageConsumptionKwhPer100Km ?? 17,
      maximumAcPowerKw: initial?.maximumAcPowerKw ?? 11,
      maximumDcPowerKw: initial?.maximumDcPowerKw ?? 100,
      imageUrl: initial?.imageUrl ?? '',
      vin: initial?.vin ?? '',
      licensePlate: initial?.licensePlate ?? '',
      supportedPlugTypes: initial?.supportedPlugTypes ?? ['CCS2', 'TYPE_2'],
      notes: initial?.notes ?? '',
      status: initial?.status ?? 'ACTIVE',
      isDefault: initial?.isDefault ?? false,
    },
  });

  const vehicleType = useWatch({ control, name: 'vehicleType' });
  const supportedPlugTypes = useWatch({ control, name: 'supportedPlugTypes' });
  const status = useWatch({ control, name: 'status' });
  async function next() {
    const fields =
      step === 0
        ? (['nickname', 'brand', 'model', 'version', 'year'] as const)
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
      nickname: values.nickname.trim(),
      model: values.model,
      year: values.year,
      status: values.status,
      vehicleType: values.vehicleType,
      batteryCapacityKwh: values.batteryCapacityKwh,
      estimatedRangeKm: values.estimatedRangeKm,
      averageConsumptionKwhPer100Km: values.averageConsumptionKwhPer100Km,
      maximumAcPowerKw: values.maximumAcPowerKw,
      maximumDcPowerKw: values.maximumDcPowerKw,
      supportedPlugTypes: values.supportedPlugTypes,
      isDefault: values.isDefault,
    };
    if (values.version.trim()) input.version = values.version.trim();
    if (values.licensePlate.trim()) input.licensePlate = values.licensePlate.trim();
    if (values.color.trim()) input.color = values.color.trim();
    if (values.vin.trim()) input.vin = values.vin.trim().toUpperCase();
    if (values.imageUrl.trim()) input.imageUrl = values.imageUrl.trim();
    if (values.notes.trim()) input.notes = values.notes.trim();
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
            name="nickname"
            render={({ field }) => (
              <AppTextField
                label="Apelido"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.nickname?.message}
                hint="Ex.: Meu carro, Carro da família"
              />
            )}
          />
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
                onChangeText={field.onChange}
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
                onChangeText={(value) => field.onChange(Number(value))}
                error={errors.year?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <AppTextField
                label="Cor opcional"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.color?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <AppTextField
                autoCapitalize="none"
                keyboardType="url"
                label="URL da foto opcional"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.imageUrl?.message}
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
            <FilterChip
              label="Híbrido"
              selected={vehicleType === 'HEV'}
              onPress={() => setValue('vehicleType', 'HEV')}
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
          <Controller
            control={control}
            name="averageConsumptionKwhPer100Km"
            render={({ field }) => (
              <AppTextField
                keyboardType="decimal-pad"
                label="Consumo médio (kWh/100 km)"
                value={String(field.value)}
                onChangeText={(value) => field.onChange(Number(value))}
                error={errors.averageConsumptionKwhPer100Km?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="maximumAcPowerKw"
            render={({ field }) => (
              <AppTextField
                keyboardType="decimal-pad"
                label="Potência máxima AC (kW)"
                value={String(field.value)}
                onChangeText={(value) => field.onChange(Number(value))}
                error={errors.maximumAcPowerKw?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="maximumDcPowerKw"
            render={({ field }) => (
              <AppTextField
                keyboardType="decimal-pad"
                label="Potência máxima DC (kW)"
                value={String(field.value)}
                onChangeText={(value) => field.onChange(Number(value))}
                error={errors.maximumDcPowerKw?.message}
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
            {(['CCS2', 'TYPE_2', 'CHADEMO', 'NACS', 'GB_T'] as PlugType[]).map((plug) => {
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
            name="vin"
            render={({ field }) => (
              <AppTextField
                autoCapitalize="characters"
                label="VIN opcional"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.vin?.message}
                hint="17 caracteres, sem I, O ou Q."
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <AppTextField
                label="Observações"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.notes?.message}
                multiline
              />
            )}
          />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Situação do veículo
          </Text>
          <View style={styles.chips}>
            <FilterChip
              label="Ativo"
              selected={status === 'ACTIVE'}
              onPress={() => setValue('status', 'ACTIVE')}
            />
            <FilterChip
              label="Inativo"
              selected={status === 'INACTIVE'}
              onPress={() => setValue('status', 'INACTIVE')}
            />
            <FilterChip
              label="Vendido"
              selected={status === 'SOLD'}
              onPress={() => setValue('status', 'SOLD')}
            />
          </View>
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
