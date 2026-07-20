import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { z } from 'zod';

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
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });

  return (
    <Screen>
      <AppHeader canGoBack title="Criar conta" subtitle="Seus dados serão tratados conforme a LGPD." />
      <Controller control={control} name="name" render={({ field }) => (
        <AppTextField label="Nome" value={field.value} onChangeText={field.onChange} error={errors.name?.message} />
      )} />
      <Controller control={control} name="email" render={({ field }) => (
        <AppTextField autoCapitalize="none" keyboardType="email-address" label="E-mail" value={field.value} onChangeText={field.onChange} error={errors.email?.message} />
      )} />
      <Controller control={control} name="phone" render={({ field }) => (
        <AppTextField keyboardType="phone-pad" label="Telefone" value={field.value} onChangeText={field.onChange} error={errors.phone?.message} />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <AppTextField secureTextEntry label="Senha" value={field.value} onChangeText={field.onChange} error={errors.password?.message} />
      )} />
      <AppButton
        label="Aceitar termos e criar conta"
        onPress={handleSubmit(() =>
          Alert.alert('Cadastro mock concluído', 'Confirmação de e-mail preparada.', [
            { text: 'Continuar', onPress: () => router.replace('/(tabs)/stations') },
          ]),
        )}
      />
    </Screen>
  );
}
