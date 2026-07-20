import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function CouponsScreen() {
  const { colors } = useAppTheme();

  return (
    <Screen>
      <AppHeader canGoBack title="Cupons e créditos" />
      <AppCard>
        <Text style={[styles.value, { color: colors.primary }]}>R$ 18,00</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>Créditos promocionais disponíveis</Text>
      </AppCard>
      <AppCard>
        <AppTextField label="Código do cupom" placeholder="SOLIS-BEMVINDO" />
        <View style={styles.action}>
          <AppButton
            label="Aplicar cupom"
            onPress={() => Alert.alert('Cupom mock', 'Código validado para demonstração.')}
          />
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 32, fontWeight: '900' },
  body: { fontSize: 14, marginTop: 4 },
  action: { marginTop: 14 },
});
