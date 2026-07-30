import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { PaymentMethodCard } from '@/components/PaymentMethodCard';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/design-system';
import { paymentKeys } from '@/payments/query-keys';
import { useAppTheme } from '@/theme/ThemeProvider';
import { decimalInputToMinor } from '@/utils/format';

export const autoRechargeSchema = z
  .object({
    consentConfirmed: z.boolean(),
    enabled: z.boolean(),
    minimumBalance: z.string().refine((value) => {
      const minor = decimalInputToMinor(value);
      return minor !== null && BigInt(minor) >= 0n;
    }, 'Informe um saldo mínimo válido.'),
    paymentMethodId: z.string().min(1, 'Selecione um método de pagamento.'),
    rechargeAmount: z.string().refine((value) => {
      const minor = decimalInputToMinor(value);
      return minor !== null && BigInt(minor) >= 5000n && BigInt(minor) <= 200000n;
    }, 'Informe um valor entre R$ 50,00 e R$ 2.000,00.'),
  })
  .refine((values) => !values.enabled || values.consentConfirmed, {
    message: 'Confirme o consentimento para ativar.',
    path: ['consentConfirmed'],
  });

type AutoRechargeForm = z.infer<typeof autoRechargeSchema>;

export default function AutoRechargeScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 'anonymous';
  const rule = useQuery({
    queryKey: paymentKeys.autoRecharge(userId),
    queryFn: () => api.payments.getAutoRecharge(),
    enabled: Boolean(user),
  });
  const methods = useQuery({
    queryKey: paymentKeys.methods(userId),
    queryFn: () => api.payments.list(),
    enabled: Boolean(user),
  });
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setValue,
  } = useForm<AutoRechargeForm>({
    defaultValues: {
      consentConfirmed: false,
      enabled: false,
      minimumBalance: '50,00',
      paymentMethodId: '',
      rechargeAmount: '100,00',
    },
    resolver: zodResolver(autoRechargeSchema),
  });
  const enabled = useWatch({ control, name: 'enabled' });
  const paymentMethodId = useWatch({ control, name: 'paymentMethodId' });

  useEffect(() => {
    if (!rule.data) return;
    reset({
      consentConfirmed: rule.data.enabled,
      enabled: rule.data.enabled,
      minimumBalance: minorToInput(rule.data.minimumBalanceMinor),
      paymentMethodId: rule.data.paymentMethodId ?? '',
      rechargeAmount: minorToInput(rule.data.rechargeAmountMinor),
    });
  }, [reset, rule.data]);

  const update = useMutation({
    mutationFn: (values: AutoRechargeForm) => {
      const minimumBalanceMinor = decimalInputToMinor(values.minimumBalance);
      const rechargeAmountMinor = decimalInputToMinor(values.rechargeAmount);
      if (!minimumBalanceMinor || !rechargeAmountMinor) throw new Error('Valores inválidos.');
      return api.payments.updateAutoRecharge({
        consentConfirmed: values.consentConfirmed,
        currency: 'BRL',
        enabled: values.enabled,
        minimumBalanceMinor,
        paymentMethodId: values.paymentMethodId,
        rechargeAmountMinor,
      });
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(paymentKeys.autoRecharge(userId), updated);
      await queryClient.invalidateQueries({ queryKey: paymentKeys.autoRecharge(userId) });
      feedback.showSnackbar(updated.enabled ? 'Recarga automática ativada.' : 'Configuração salva.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });
  const disable = useMutation({
    mutationFn: () => api.payments.disableAutoRecharge(),
    onSuccess: (updated) => {
      queryClient.setQueryData(paymentKeys.autoRecharge(userId), updated);
      reset((current) => ({ ...current, consentConfirmed: false, enabled: false }));
      feedback.showSnackbar('Recarga automática desativada.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  if (rule.isLoading || methods.isLoading) {
    return <Screen><LoadingState title="Carregando configuração" /></Screen>;
  }
  if (rule.isError || methods.isError) {
    const error = rule.error ?? methods.error;
    return (
      <Screen>
        <ErrorState
          actionLabel="Tentar novamente"
          {...(error?.message ? { message: error.message } : {})}
          onAction={() => {
            void rule.refetch();
            void methods.refetch();
          }}
          title="Não foi possível carregar a recarga automática"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader canGoBack title="Recarga automática" subtitle="Você mantém o controle do saldo" />
      <AppCard>
        <View style={styles.switchRow}>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Ativar automação</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              Recarrega somente quando o saldo ficar abaixo do limite.
            </Text>
          </View>
          <Controller
            control={control}
            name="enabled"
            render={({ field: { onChange, value } }) => (
              <Switch accessibilityLabel="Ativar recarga automática" onValueChange={onChange} value={value} />
            )}
          />
        </View>
      </AppCard>
      <Controller
        control={control}
        name="minimumBalance"
        render={({ field: { onBlur, onChange, value } }) => (
          <AppTextField
            editable={enabled}
            error={errors.minimumBalance?.message}
            keyboardType="decimal-pad"
            label="Recarregar quando o saldo ficar abaixo de"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="rechargeAmount"
        render={({ field: { onBlur, onChange, value } }) => (
          <AppTextField
            editable={enabled}
            error={errors.rechargeAmount?.message}
            keyboardType="decimal-pad"
            label="Valor de cada recarga"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {enabled ? (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Método tokenizado</Text>
          {methods.data?.filter((method) => method.type === 'CREDIT_CARD' && method.status === 'ACTIVE')
            .map((method) => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                onPress={() => setValue('paymentMethodId', method.id, { shouldValidate: true })}
                selected={paymentMethodId === method.id}
              />
            ))}
          {errors.paymentMethodId ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {errors.paymentMethodId.message}
            </Text>
          ) : null}
          <AppCard>
            <Controller
              control={control}
              name="consentConfirmed"
              render={({ field: { onChange, value } }) => (
                <View style={styles.switchRow}>
                  <Text style={[styles.consent, { color: colors.text }]}>
                    Autorizo cobranças automáticas neste método, conforme os valores acima.
                  </Text>
                  <Switch accessibilityLabel="Confirmar consentimento" onValueChange={onChange} value={value} />
                </View>
              )}
            />
            {errors.consentConfirmed ? (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {errors.consentConfirmed.message}
              </Text>
            ) : null}
          </AppCard>
        </>
      ) : null}
      <AppButton
        label="Salvar configuração"
        loading={update.isPending}
        onPress={handleSubmit((values) => update.mutate(values))}
      />
      {rule.data?.enabled ? (
        <AppButton
          label="Desativar recarga automática"
          loading={disable.isPending}
          onPress={() => disable.mutate()}
          variant="outline"
        />
      ) : null}
    </Screen>
  );
}

function minorToInput(minor: string): string {
  const value = BigInt(minor);
  return `${value / 100n},${(value % 100n).toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  consent: { flex: 1, fontSize: 13, lineHeight: 19 },
});
