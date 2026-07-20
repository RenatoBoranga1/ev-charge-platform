import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'marina.souza@example.com', password: 'solis-demo' },
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
      </AppCard>
      <AppButton
        label="Entrar"
        onPress={handleSubmit(() => {
          Alert.alert('Login mock', 'Autenticação aceita para demonstração.');
          router.replace('/(tabs)/stations');
        })}
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
  link: { minHeight: 44, textAlignVertical: 'center', fontWeight: '800', marginTop: 8 },
});
