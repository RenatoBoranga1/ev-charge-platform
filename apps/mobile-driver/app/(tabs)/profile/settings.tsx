import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useAppTheme } from '@/theme/ThemeProvider';

const settings = [
  ['chargingNotifications', 'Notificações de recarga'],
  ['promotions', 'Novidades e promoções'],
  ['reservationAlerts', 'Avisos de reservas'],
  ['favoriteStationAlerts', 'Estação favorita disponível'],
  ['emailReceipts', 'Recibos por e-mail'],
  ['dataSaver', 'Modo de economia de dados'],
] as const;

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const preferences = usePreferencesStore();
  const setHideReminder = usePreferencesStore((state) => state.setHideCableReminder);

  return (
    <Screen>
      <AppHeader canGoBack title="Preferências e privacidade" />
      {settings.map(([key, label]) => (
        <View key={key} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          <Switch
            accessibilityLabel={label}
            value={preferences[key]}
            onValueChange={() => preferences.toggle(key)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      ))}
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Ocultar lembrete do cabo</Text>
        <Switch
          accessibilityLabel="Ocultar lembrete do cabo"
          value={preferences.hideCableReminder}
          onValueChange={setHideReminder}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>
      <AppButton
        label="Ver política de privacidade"
        variant="outline"
        onPress={() => Alert.alert('Privacidade Solis', 'Consentimento, finalidade, retenção, portabilidade e exclusão serão publicados antes da produção.')}
      />
      <AppButton
        label="Ver termos de uso"
        variant="outline"
        onPress={() => Alert.alert('Termos mock', 'Conteúdo jurídico pendente de revisão especializada.')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
});
