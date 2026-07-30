import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/design-system';
import { paymentKeys } from '@/payments/query-keys';
import { useAppTheme } from '@/theme/ThemeProvider';
import { decimalInputToMinor, formatMinorMoney } from '@/utils/format';

const presets = ['5000', '10000', '15000', '20000'] as const;

export const topUpFormSchema = z.object({
  amount: z.string().refine((value) => {
    const minor = decimalInputToMinor(value);
    return minor !== null && BigInt(minor) >= 5000n && BigInt(minor) <= 200000n;
  }, 'Informe um valor entre R$ 50,00 e R$ 2.000,00.'),
});

type TopUpForm = z.infer<typeof topUpFormSchema>;

export default function AddFundsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 'anonymous';
  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm<TopUpForm>({
    defaultValues: { amount: '50,00' },
    resolver: zodResolver(topUpFormSchema),
  });
  const amount = useWatch({ control, name: 'amount' });
  const selectedMinor = decimalInputToMinor(amount);
  const mutation = useMutation({
    mutationFn: async (values: TopUpForm) => {
      const amountMinor = decimalInputToMinor(values.amount);
      if (!amountMinor) throw new Error('Valor inválido.');
      return api.payments.createTopUp({
        amountMinor,
        currency: 'BRL',
        idempotencyKey: `mobile-topup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method: 'PIX',
      });
    },
    onSuccess: async (payment) => {
      await queryClient.invalidateQueries({ queryKey: paymentKeys.wallet(userId) });
      router.replace({
        pathname: '/(tabs)/profile/pix-[paymentId]' as never,
        params: { paymentId: payment.id },
      });
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  return (
    <Screen>
      <AppHeader canGoBack title="Adicionar saldo" subtitle="Pague com Pix no ambiente seguro" />
      <Text style={[styles.label, { color: colors.text }]}>Escolha um valor</Text>
      <View style={styles.presets}>
        {presets.map((minor) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedMinor === minor }}
            key={minor}
            onPress={() => setValue('amount', formatInput(minor), { shouldValidate: true })}
            style={[
              styles.preset,
              {
                backgroundColor:
                  selectedMinor === minor ? colors.primaryContainer : colors.surface,
                borderColor: selectedMinor === minor ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.presetText, { color: colors.text }]}>
              {formatMinorMoney(minor, 'BRL')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Controller
        control={control}
        name="amount"
        render={({ field: { onBlur, onChange, value } }) => (
          <AppTextField
            error={errors.amount?.message}
            hint="Mínimo de R$ 50,00 e máximo de R$ 2.000,00."
            keyboardType="decimal-pad"
            label="Outro valor"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="0,00"
            value={value}
          />
        )}
      />
      <AppCard>
        <Text style={[styles.security, { color: colors.textMuted }]}>
          A criação é idempotente: repetir uma solicitação não credita a carteira duas vezes.
          O saldo só muda após a confirmação do provedor.
        </Text>
      </AppCard>
      <AppButton
        label="Gerar Pix"
        loading={mutation.isPending}
        onPress={handleSubmit((values) => mutation.mutate(values))}
      />
    </Screen>
  );
}

function formatInput(minor: string): string {
  const value = BigInt(minor);
  return `${value / 100n},${(value % 100n).toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '900' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 13,
    width: '48%',
  },
  presetText: { fontSize: 15, fontWeight: '800' },
  security: { fontSize: 13, lineHeight: 19 },
});
