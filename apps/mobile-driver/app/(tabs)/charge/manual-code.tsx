import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { useChargingStore } from '@/stores/charging-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import { manualConnectorCodeSchema } from '@/utils/manual-code';

const formSchema = z.object({
  code: manualConnectorCodeSchema,
});
type FormValues = z.infer<typeof formSchema>;

export default function ManualCodeScreen() {
  const { colors } = useAppTheme();
  const setValidatedConnector = useChargingStore(
    (state) => state.setValidatedConnector,
  );
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '' },
  });
  const mutation = useMutation({
    mutationFn: ({ code }: FormValues) => api.charging.validateManualCode(code),
    onSuccess: (validated) => {
      setValidatedConnector(validated);
      router.replace('/(tabs)/charge/preparing');
    },
  });

  return (
    <Screen>
      <AppHeader
        canGoBack
        title="Informar código"
        subtitle="O código fica próximo ao QR Code do conector."
      />
      <AppCard>
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <AppTextField
              autoCapitalize="characters"
              autoCorrect={false}
              label="Código do conector"
              placeholder="SOLIS-001-A"
              hint="Exemplo: SOLIS-001-A"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.code?.message}
            />
          )}
        />
        <Text style={[styles.security, { color: colors.textMuted }]}>
          O aplicativo valida o formato localmente e sempre confirma a disponibilidade no backend.
        </Text>
      </AppCard>
      {mutation.error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {mutation.error.message}
        </Text>
      ) : null}
      <AppButton
        label="Validar código"
        loading={mutation.isPending}
        onPress={handleSubmit((values) => mutation.mutate(values))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  security: { marginTop: 16, fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14, fontWeight: '700' },
});
