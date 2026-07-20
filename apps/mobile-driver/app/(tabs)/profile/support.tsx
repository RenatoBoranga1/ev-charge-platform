import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function SupportScreen() {
  const { colors } = useAppTheme();
  const [message, setMessage] = useState('');

  return (
    <Screen>
      <AppHeader canGoBack title="Ajuda Solis" subtitle="Atendimento seguro durante sua recarga." />
      <AppCard>
        <Text style={[styles.title, { color: colors.text }]}>Antes de enviar</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Em caso de emergência, afaste-se do equipamento e procure o responsável pelo local.
        </Text>
      </AppCard>
      <AppTextField
        label="Como podemos ajudar?"
        multiline
        numberOfLines={5}
        value={message}
        onChangeText={setMessage}
        placeholder="Descreva o problema e informe o código do conector."
        style={styles.textArea}
      />
      <AppButton
        label="Enviar solicitação mock"
        disabled={message.trim().length < 10}
        onPress={() => {
          setMessage('');
          Alert.alert('Solicitação registrada', 'Protocolo mock SOLIS-2026-001.');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  textArea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 14 },
});
