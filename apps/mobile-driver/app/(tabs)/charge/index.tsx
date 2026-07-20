import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppModal } from '@/components/AppModal';
import { Screen } from '@/components/Screen';
import { messages } from '@/i18n/pt-BR';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function ChargeHomeScreen() {
  const { colors } = useAppTheme();
  const hideReminder = usePreferencesStore((state) => state.hideCableReminder);
  const setHideReminder = usePreferencesStore((state) => state.setHideCableReminder);
  const [showReminder, setShowReminder] = useState(!hideReminder);
  const [remember, setRemember] = useState(false);

  function proceed() {
    if (remember) setHideReminder(true);
    setShowReminder(false);
    router.push('/(tabs)/charge/scanner');
  }

  return (
    <Screen>
      <AppHeader
        title="Comece sua recarga"
        subtitle="Leia o conector com segurança ou informe o código impresso."
      />
      <AppCard>
        <View style={[styles.heroIcon, { backgroundColor: colors.elevatedSurface }]}>
          <Ionicons name="flash" size={42} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Energia simples, do cabo ao recibo
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          A Solis valida o conector, o veículo e o pagamento antes de solicitar o início.
        </Text>
        <View style={styles.steps}>
          <Step number="1" text="Conecte o cabo ao veículo" />
          <Step number="2" text="Escaneie o QR Code do equipamento" />
          <Step number="3" text="Revise e confirme a recarga" />
        </View>
      </AppCard>
      <AppButton
        label="Escanear carregador"
        onPress={() => (hideReminder ? router.push('/(tabs)/charge/scanner') : setShowReminder(true))}
      />
      <AppButton
        label="Inserir código manual"
        variant="outline"
        onPress={() => router.push('/(tabs)/charge/manual-code')}
      />

      <AppModal
        visible={showReminder}
        title={messages.charge.connectTitle}
        onClose={() => setShowReminder(false)}
      >
        <View style={[styles.illustration, { backgroundColor: colors.elevatedSurface }]}>
          <Ionicons name="car-sport-outline" size={58} color={colors.secondary} />
          <Ionicons name="git-commit-outline" size={42} color={colors.primary} />
          <Ionicons name="checkmark-circle" size={32} color={colors.success} />
        </View>
        <Text style={[styles.modalBody, { color: colors.textMuted }]}>
          {messages.charge.connectBody}
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
          onPress={() => setRemember((value) => !value)}
          style={styles.checkboxRow}
        >
          <Ionicons
            name={remember ? 'checkbox' : 'square-outline'}
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.checkboxText, { color: colors.text }]}>
            Não mostrar novamente
          </Text>
        </Pressable>
        <View style={styles.modalActions}>
          <View style={styles.modalAction}>
            <AppButton
              label="Agora não"
              variant="ghost"
              onPress={() => setShowReminder(false)}
            />
          </View>
          <View style={styles.modalAction}>
            <AppButton label="Continuar" onPress={proceed} />
          </View>
        </View>
      </AppModal>
    </Screen>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
        <Text style={[styles.stepNumberText, { color: colors.onPrimary }]}>{number}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 23, fontWeight: '900', marginTop: 18 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  steps: { gap: 13, marginTop: 22 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 13, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 15, fontWeight: '600' },
  illustration: {
    height: 130,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  modalBody: { fontSize: 15, lineHeight: 22 },
  checkboxRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkboxText: { fontSize: 14, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalAction: { flex: 1 },
});
