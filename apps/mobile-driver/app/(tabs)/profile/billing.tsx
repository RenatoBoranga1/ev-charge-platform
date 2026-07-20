import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function BillingScreen() {
  const { colors } = useAppTheme();
  const [document, setDocument] = useState('');
  const [postalCode, setPostalCode] = useState('');

  return (
    <Screen>
      <AppHeader canGoBack title="Informações de cobrança" />
      <Text style={[styles.notice, { color: colors.textMuted }]}>
        Dados sensíveis são mascarados e criptografados no backend. Esta tela não persiste valores no modo mock.
      </Text>
      <AppCard>
        <AppTextField
          keyboardType="number-pad"
          label="CPF ou CNPJ"
          placeholder="•••.•••.•••-••"
          value={document}
          onChangeText={setDocument}
        />
        <AppTextField
          keyboardType="number-pad"
          label="CEP"
          placeholder="00000-000"
          value={postalCode}
          onChangeText={setPostalCode}
        />
        <AppTextField label="Endereço de cobrança" placeholder="Rua, número e complemento" />
      </AppCard>
      <AppButton
        label="Salvar informações"
        disabled={document.length < 11 || postalCode.length < 8}
        onPress={() => Alert.alert('Dados mock', 'Informações validadas sem persistência.')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { fontSize: 14, lineHeight: 20 },
});
