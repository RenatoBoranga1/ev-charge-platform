import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { getDemoCredentials } from '@/config/runtime';
import { useAppTheme } from '@/theme/ThemeProvider';

const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useAppTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const demoCredentials = getDemoCredentials();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: demoCredentials ?? { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn(values);
      router.replace('/');
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Não foi possível entrar.',
      );
    }
  });

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Entrar na Solis" subtitle="Retome sua jornada elétrica." />
      <AppCard>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <AppTextField
              autoCapitalize="none"
              keyboardType="email-address"
              label="E-mail"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <AppTextField
              label="Senha"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.password?.message}
            />
          )}
        />
        <Text
          accessibilityRole="link"
          onPress={() => router.push('/(auth)/forgot-password')}
          style={[styles.link, { color: colors.secondary }]}
        >
          Esqueci minha senha
        </Text>
        {demoCredentials ? (
          <Text style={[styles.demo, { color: colors.textMuted }]}>
            Demonstração: {demoCredentials.email} / {demoCredentials.password}
          </Text>
        ) : null}
        {submitError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {submitError}
          </Text>
        ) : null}
      </AppCard>
      <AppButton
        disabled={isSubmitting}
        label={isSubmitting ? 'Entrando…' : 'Entrar'}
        onPress={() => void submit()}
      />
      <AppButton
        label="Criar conta"
        variant="outline"
        onPress={() => router.push('/(auth)/register')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  demo: { fontSize: 12, marginTop: 8 },
  error: { color: '#B42318', fontSize: 13, fontWeight: '700', marginTop: 8 },
  link: {
    minHeight: 44,
    textAlignVertical: 'center',
    fontWeight: '800',
    marginTop: 8,
  },
});
