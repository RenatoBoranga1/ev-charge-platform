import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { Card, Chip, Tag } from '@/design-system';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import {
  type DynamicColorSeed,
  type ThemeMode,
} from '@/theme/design-tokens';

const settings = [
  ['chargingNotifications', 'Notificações de recarga'],
  ['promotions', 'Novidades e promoções'],
  ['reservationAlerts', 'Avisos de reservas'],
  ['favoriteStationAlerts', 'Estação favorita disponível'],
  ['emailReceipts', 'Recibos por e-mail'],
  ['dataSaver', 'Modo de economia de dados'],
] as const;

const themeModes: { label: string; value: ThemeMode }[] = [
  { label: 'Sistema', value: 'system' },
  { label: 'Claro', value: 'light' },
  { label: 'Escuro', value: 'dark' },
];

const colorSeeds: { label: string; value: DynamicColorSeed }[] = [
  { label: 'Solis', value: 'solis' },
  { label: 'Oceano', value: 'ocean' },
  { label: 'Solar', value: 'solar' },
];

export default function SettingsScreen() {
  const { colors, typeScale } = useAppTheme();
  const preferences = usePreferencesStore();
  const setHideReminder = usePreferencesStore(
    (state) => state.setHideCableReminder,
  );

  return (
    <Screen>
      <AppHeader canGoBack title="Preferências e privacidade" />

      <Card variant="filled">
        <View style={styles.sectionTitle}>
          <Text style={[typeScale.titleMedium, { color: colors.text }]}>
            Aparência
          </Text>
          <Tag label="Material 3" tone="primary" />
        </View>
        <Text style={[typeScale.bodyMedium, { color: colors.textMuted }]}>
          O modo Sistema acompanha automaticamente a configuração do aparelho.
        </Text>
        <View style={styles.choices}>
          {themeModes.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              onPress={() => preferences.setThemeMode(item.value)}
              selected={preferences.themeMode === item.value}
            />
          ))}
        </View>
        <Text style={[typeScale.titleSmall, { color: colors.text }]}>
          Cor dinâmica
        </Text>
        <View style={styles.choices}>
          {colorSeeds.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              onPress={() => preferences.setDynamicColorSeed(item.value)}
              selected={preferences.dynamicColorSeed === item.value}
            />
          ))}
        </View>
      </Card>

      <Text style={[typeScale.titleMedium, styles.groupTitle, { color: colors.text }]}>
        Comunicação e dados
      </Text>
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
        <Text style={[styles.label, { color: colors.text }]}>
          Ocultar lembrete do cabo
        </Text>
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
        onPress={() =>
          Alert.alert(
            'Privacidade Solis',
            'Consentimento, finalidade, retenção, portabilidade e exclusão serão publicados antes da produção.',
          )
        }
      />
      <AppButton
        label="Ver termos de uso"
        variant="outline"
        onPress={() =>
          Alert.alert(
            'Termos mock',
            'Conteúdo jurídico pendente de revisão especializada.',
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  groupTitle: {
    marginTop: 12,
  },
  row: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
});
