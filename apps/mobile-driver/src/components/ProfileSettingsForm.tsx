import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from './AppButton';
import { FilterChip } from './FilterChip';
import { AppCard } from './AppCard';
import { useAppTheme } from '@/theme/ThemeProvider';
import type {
  ProfileTheme,
  UpdateProfileInput,
  UserProfile,
} from '@/types/domain';

const settingsSchema = z.object({
  theme: z.enum(['SYSTEM', 'LIGHT', 'DARK']),
  preferences: z.object({ dataSaver: z.boolean() }),
  notifications: z.object({
    chargingNotifications: z.boolean(),
    emailReceipts: z.boolean(),
    favoriteStationAlerts: z.boolean(),
    promotions: z.boolean(),
    reservationAlerts: z.boolean(),
  }),
  privacy: z.object({
    analyticsConsent: z.boolean(),
    marketingConsent: z.boolean(),
    personalizedOffers: z.boolean(),
  }),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const themes: { label: string; value: ProfileTheme }[] = [
  { label: 'Sistema', value: 'SYSTEM' },
  { label: 'Claro', value: 'LIGHT' },
  { label: 'Escuro', value: 'DARK' },
];
const notificationFields = [
  ['chargingNotifications', 'Notificações de recarga'],
  ['emailReceipts', 'Recibos por e-mail'],
  ['favoriteStationAlerts', 'Alertas de estações favoritas'],
  ['promotions', 'Novidades e promoções'],
  ['reservationAlerts', 'Avisos de reservas'],
] as const;
const privacyFields = [
  ['analyticsConsent', 'Compartilhar métricas anônimas'],
  ['marketingConsent', 'Consentimento de marketing'],
  ['personalizedOffers', 'Ofertas personalizadas'],
] as const;

interface ProfileSettingsFormProps {
  loading?: boolean;
  onSubmit: (input: UpdateProfileInput) => void;
  profile: UserProfile;
}

export function ProfileSettingsForm({
  loading = false,
  onSubmit,
  profile,
}: ProfileSettingsFormProps) {
  const { colors } = useAppTheme();
  const { control, handleSubmit, setValue } = useForm<SettingsFormValues>({
    defaultValues: {
      notifications: profile.notifications,
      preferences: profile.preferences,
      privacy: profile.privacy,
      theme: profile.theme,
    },
    resolver: zodResolver(settingsSchema),
  });
  const selectedTheme = useWatch({ control, name: 'theme' });

  function submit(values: SettingsFormValues) {
    onSubmit({
      notifications: values.notifications,
      preferences: values.preferences,
      privacy: values.privacy,
      recordVersion: profile.recordVersion,
      theme: values.theme,
    });
  }

  return (
    <View style={styles.form}>
      <AppCard>
        <Text style={[styles.title, { color: colors.text }]}>Aparência</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>
          O modo Sistema acompanha automaticamente a configuração do aparelho.
        </Text>
        <View style={styles.chips}>
          {themes.map((theme) => (
            <FilterChip
              key={theme.value}
              label={theme.label}
              onPress={() => setValue('theme', theme.value)}
              selected={selectedTheme === theme.value}
            />
          ))}
        </View>
      </AppCard>

      <Text style={[styles.title, { color: colors.text }]}>Comunicação</Text>
      {notificationFields.map(([key, label]) => (
        <Controller
          key={key}
          control={control}
          name={`notifications.${key}`}
          render={({ field }) => (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
              <Switch
                accessibilityLabel={label}
                onValueChange={field.onChange}
                trackColor={{ false: colors.border, true: colors.primary }}
                value={field.value}
              />
            </View>
          )}
        />
      ))}
      <Controller
        control={control}
        name="preferences.dataSaver"
        render={({ field }) => (
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              Economia de dados
            </Text>
            <Switch
              accessibilityLabel="Economia de dados"
              onValueChange={field.onChange}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={field.value}
            />
          </View>
        )}
      />

      <Text style={[styles.title, { color: colors.text }]}>Privacidade e LGPD</Text>
      {privacyFields.map(([key, label]) => (
        <Controller
          key={key}
          control={control}
          name={`privacy.${key}`}
          render={({ field }) => (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
              <Switch
                accessibilityLabel={label}
                onValueChange={field.onChange}
                trackColor={{ false: colors.border, true: colors.primary }}
                value={field.value}
              />
            </View>
          )}
        />
      ))}
      <Text style={[styles.description, { color: colors.textMuted }]}>
        Os consentimentos podem ser alterados a qualquer momento. Exclusão e
        portabilidade seguem o fluxo de confirmação de identidade.
      </Text>
      <AppButton
        label="Salvar preferências"
        loading={loading}
        onPress={handleSubmit(submit)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  title: { fontSize: 17, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
});
