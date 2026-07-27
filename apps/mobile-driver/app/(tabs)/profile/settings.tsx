import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Text } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { ProfileSettingsForm } from '@/components/ProfileSettingsForm';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/design-system';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { UpdateProfileInput } from '@/types/domain';

const localBooleanKeys = [
  'chargingNotifications',
  'promotions',
  'reservationAlerts',
  'favoriteStationAlerts',
  'emailReceipts',
  'dataSaver',
] as const;

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.users.getMe(),
  });
  const update = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.users.update(input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['profile'], updated);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      const preferences = usePreferencesStore.getState();
      preferences.setThemeMode(updated.theme.toLowerCase() as 'system' | 'light' | 'dark');
      for (const key of localBooleanKeys) {
        const nextValue =
          key === 'dataSaver'
            ? updated.preferences.dataSaver
            : updated.notifications[key];
        if (preferences[key] !== nextValue) preferences.toggle(key);
      }
      feedback.showSnackbar('Preferências salvas.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  if (profile.isLoading) {
    return <Screen><LoadingState title="Carregando preferências" /></Screen>;
  }
  if (profile.isError) {
    return (
      <Screen>
        <AppHeader canGoBack title="Preferências e privacidade" />
        <ErrorState
          actionLabel="Tentar novamente"
          message={profile.error.message}
          onAction={() => void profile.refetch()}
          title="Não foi possível carregar suas preferências"
        />
      </Screen>
    );
  }
  if (!profile.data) return null;

  return (
    <Screen>
      <AppHeader canGoBack title="Preferências e privacidade" />
      <ProfileSettingsForm
        loading={update.isPending}
        onSubmit={(input) => update.mutate(input)}
        profile={profile.data}
      />
      {update.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {update.error.message}
        </Text>
      ) : null}
      <AppButton
        label="Política de privacidade"
        onPress={() =>
          Alert.alert(
            'Privacidade Solis',
            'Finalidade, retenção, portabilidade e exclusão serão publicadas antes da produção.',
          )
        }
        variant="outline"
      />
      <AppButton
        label="Termos de uso"
        onPress={() =>
          Alert.alert(
            'Termos de uso',
            'Conteúdo jurídico pendente de revisão especializada.',
          )
        }
        variant="outline"
      />
    </Screen>
  );
}
