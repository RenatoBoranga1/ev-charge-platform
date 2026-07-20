import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function TripsScreen() {
  const { colors } = useAppTheme();

  return (
    <Screen>
      <AppHeader
        title="Planeje com confiança"
        subtitle="Antecipe autonomia, paradas, tempo e custo da sua viagem."
      />
      <AppCard>
        <View style={[styles.icon, { backgroundColor: colors.elevatedSurface }]}>
          <Ionicons name="navigate" size={34} color={colors.secondary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Planejador inteligente, sem segredos
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          A primeira versão usa um provedor mock transparente. Nenhuma chave de mapas está incluída.
        </Text>
        <View style={styles.features}>
          <Feature text="Estimativa de bateria na chegada" />
          <Feature text="Paradas compatíveis com seu veículo" />
          <Feature text="Comparação entre menor custo e menor tempo" />
        </View>
      </AppCard>
      <AppButton label="Criar uma rota" onPress={() => router.push('/(tabs)/trips/plan')} />
    </Screen>
  );
}

function Feature({ text }: { text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.feature}>
      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '900', marginTop: 18 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  features: { gap: 12, marginTop: 22 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  featureText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
