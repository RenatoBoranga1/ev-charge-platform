import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { api } from '@/api';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { ProfileForm } from '@/components/ProfileForm';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/design-system';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { UpdateProfileInput } from '@/types/domain';

export default function EditProfileScreen() {
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
      feedback.showSnackbar('Perfil atualizado.');
      router.back();
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  if (profile.isLoading) {
    return <Screen><LoadingState title="Carregando perfil" /></Screen>;
  }
  if (profile.isError) {
    return (
      <Screen>
        <AppHeader canGoBack title="Editar perfil" />
        <ErrorState
          actionLabel="Tentar novamente"
          message={profile.error.message}
          onAction={() => void profile.refetch()}
          title="Não foi possível carregar o perfil"
        />
      </Screen>
    );
  }
  if (!profile.data) return null;

  return (
    <Screen>
      <AppHeader canGoBack title="Editar perfil" />
      <ProfileForm
        loading={update.isPending}
        onSubmit={(input) => update.mutate(input)}
        profile={profile.data}
      />
      {update.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {update.error.message}
        </Text>
      ) : null}
    </Screen>
  );
}
