import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';

const schema = z.object({
  name: z.string().min(3, 'Informe seu nome.'),
  email: z.email('Informe um e-mail válido.'),
  phone: z.string().min(10, 'Informe um telefone válido.'),
  password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { register } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await register(values);
      router.replace('/');
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar sua conta.',
      );
    }
  });

  return (
    <Screen>
      <AppHeader
        canGoBack
        title="Criar conta"
        subtitle="Seus dados serão tratados conforme a LGPD."
      />
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <AppTextField
            label="Nome"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.name?.message}
          />
        )}
      />
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
        name="phone"
        render={({ field }) => (
          <AppTextField
            keyboardType="phone-pad"
            label="Telefone"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.phone?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <AppTextField
            secureTextEntry
            label="Senha"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.password?.message}
          />
        )}
      />
      {submitError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {submitError}
        </Text>
      ) : null}
      <AppButton
        disabled={isSubmitting}
        label={isSubmitting ? 'Criando conta…' : 'Aceitar termos e criar conta'}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: '#B42318', fontSize: 13, fontWeight: '700' },
});
