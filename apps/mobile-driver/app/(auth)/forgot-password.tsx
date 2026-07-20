import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { z } from 'zod';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';

const schema = z.object({ email: z.email('Informe um e-mail válido.') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  return (
    <Screen>
      <AppHeader canGoBack title="Recuperar acesso" subtitle="Enviaremos instruções se a conta existir." />
      <Controller control={control} name="email" render={({ field }) => (
        <AppTextField
          autoCapitalize="none"
          keyboardType="email-address"
          label="E-mail"
          value={field.value}
          onChangeText={field.onChange}
          error={errors.email?.message}
        />
      )} />
      <AppButton
        label="Enviar instruções"
        onPress={handleSubmit(() =>
          Alert.alert('Solicitação recebida', 'Fluxo de e-mail mock concluído.', [
            { text: 'Voltar ao login', onPress: () => router.replace('/(auth)/login') },
          ]),
        )}
      />
    </Screen>
  );
}
