import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';

export default function ChargeErrorScreen() {
  const params = useLocalSearchParams<{ message?: string }>();

  return (
    <Screen>
      <AppHeader canGoBack title="A recarga não começou" />
      <ErrorState
        title="Não foi possível iniciar"
        message={params.message ?? 'Confira o cabo, o conector e a forma de pagamento.'}
      />
      <AppButton
        label="Tentar novamente"
        onPress={() => router.replace('/(tabs)/charge/preparing')}
      />
      <AppButton
        label="Voltar ao mapa"
        variant="outline"
        onPress={() => router.replace('/(tabs)/stations')}
      />
    </Screen>
  );
}
