import { router } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';

export default function NotFoundScreen() {
  return (
    <Screen>
      <EmptyState
        title="Página não encontrada"
        message="O endereço acessado não existe no aplicativo."
      />
      <AppButton
        label="Voltar ao mapa"
        onPress={() => router.replace('/(tabs)/stations')}
      />
    </Screen>
  );
}
