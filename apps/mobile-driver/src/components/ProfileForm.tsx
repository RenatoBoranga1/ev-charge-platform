import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from './AppButton';
import { AppTextField } from './AppTextField';
import { Avatar } from '@/design-system';
import type {
  UpdateProfileInput,
  UserProfile,
} from '@/types/domain';

const profileSchema = z.object({
  firstName: z.string().trim().min(2, 'Informe seu nome.').max(60),
  lastName: z.string().trim().min(2, 'Informe seu sobrenome.').max(80),
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
  phone: z.string().refine(
    (value) => value === '' || /^\+?[0-9 ()-]{10,20}$/.test(value),
    'Informe um telefone válido.',
  ),
  avatarUrl: z.string().refine(
    (value) => value === '' || /^https?:\/\//i.test(value),
    'Informe uma URL válida.',
  ),
  city: z.string().refine(
    (value) => value === '' || value.trim().length >= 2,
    'Informe uma cidade válida.',
  ),
  state: z.string().refine(
    (value) => value === '' || /^[A-Za-z]{2}$/.test(value),
    'Use a sigla com duas letras.',
  ),
  country: z.string().regex(/^[A-Za-z]{2}$/, 'Use o código do país com duas letras.'),
  language: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, 'Use um idioma como pt-BR.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  loading?: boolean;
  onSubmit: (input: UpdateProfileInput) => void;
  profile: UserProfile;
}

export function ProfileForm({
  loading = false,
  onSubmit,
  profile,
}: ProfileFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      avatarUrl: profile.avatarUrl ?? '',
      city: profile.city ?? '',
      country: profile.country,
      email: profile.email,
      firstName: profile.firstName,
      language: profile.language,
      lastName: profile.lastName,
      phone: profile.phone ?? '',
      state: profile.state ?? '',
    },
    resolver: zodResolver(profileSchema),
  });
  const firstName = useWatch({ control, name: 'firstName' });
  const lastName = useWatch({ control, name: 'lastName' });
  const avatarUrl = useWatch({ control, name: 'avatarUrl' });

  function submit(values: ProfileFormValues) {
    const input: UpdateProfileInput = {
      country: values.country.toUpperCase(),
      email: values.email.trim().toLowerCase(),
      firstName: values.firstName.trim(),
      language: values.language,
      lastName: values.lastName.trim(),
      recordVersion: profile.recordVersion,
      ...(values.avatarUrl.trim() ? { avatarUrl: values.avatarUrl.trim() } : {}),
      ...(values.city.trim() ? { city: values.city.trim() } : {}),
      ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      ...(values.state.trim() ? { state: values.state.toUpperCase() } : {}),
    };
    onSubmit(input);
  }

  return (
    <View style={styles.form}>
      <View style={styles.avatar}>
        <Avatar
          name={`${firstName} ${lastName}`}
          size={88}
          {...(avatarUrl ? { source: { uri: avatarUrl } } : {})}
        />
      </View>
      <Controller
        control={control}
        name="avatarUrl"
        render={({ field }) => (
          <AppTextField
            autoCapitalize="none"
            error={errors.avatarUrl?.message}
            keyboardType="url"
            label="URL da foto"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="firstName"
        render={({ field }) => (
          <AppTextField
            error={errors.firstName?.message}
            label="Nome"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field }) => (
          <AppTextField
            error={errors.lastName?.message}
            label="Sobrenome"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <AppTextField
            autoCapitalize="none"
            error={errors.email?.message}
            keyboardType="email-address"
            label="E-mail"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <AppTextField
            error={errors.phone?.message}
            keyboardType="phone-pad"
            label="Telefone"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <AppTextField
            error={errors.city?.message}
            label="Cidade"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="state"
        render={({ field }) => (
          <AppTextField
            autoCapitalize="characters"
            error={errors.state?.message}
            label="Estado (UF)"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="country"
        render={({ field }) => (
          <AppTextField
            autoCapitalize="characters"
            error={errors.country?.message}
            label="País"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="language"
        render={({ field }) => (
          <AppTextField
            autoCapitalize="none"
            error={errors.language?.message}
            hint="Ex.: pt-BR"
            label="Idioma"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <AppButton
        label="Salvar alterações"
        loading={loading}
        onPress={handleSubmit(submit)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  avatar: { alignItems: 'center', marginBottom: 4 },
});
