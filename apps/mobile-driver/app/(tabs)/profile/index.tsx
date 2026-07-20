import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { ProfileMenuRow } from '@/components/ProfileMenuRow';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatCurrency } from '@/utils/format';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const { colors } = useAppTheme();

  if (!user) return null;

  return (
    <Screen>
      <AppHeader
        title="Sua conta Solis"
        actionLabel="Editar"
        onAction={() => router.push('/(tabs)/profile/edit')}
      />
      <View style={styles.profile}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.initials, { color: colors.onPrimary }]}>MS</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>
            {user.email}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <ProfileMetric
          icon="flash-outline"
          label="Energia"
          value={user.totalEnergyKwh.toFixed(1) + ' kWh'}
        />
        <ProfileMetric
          icon="leaf-outline"
          label="CO₂ evitado"
          value={user.avoidedCo2Kg.toFixed(1) + ' kg'}
        />
        <ProfileMetric
          icon="receipt-outline"
          label="Sessões"
          value={String(user.chargingSessions)}
        />
        <ProfileMetric
          icon="wallet-outline"
          label="Economia"
          value={formatCurrency(user.estimatedSavings)}
        />
      </View>

      <AppCard>
        <ProfileMenuRow
          icon="headset-outline"
          label="Suporte"
          onPress={() => router.push('/(tabs)/profile/support')}
        />
        <ProfileMenuRow
          icon="card-outline"
          label="Pagamentos"
          onPress={() => router.push('/(tabs)/profile/payment-methods')}
        />
        <ProfileMenuRow
          icon="time-outline"
          label="Histórico de recargas"
          onPress={() => router.push('/(tabs)/profile/charging-history')}
        />
        <ProfileMenuRow
          icon="calendar-outline"
          label="Reservas"
          onPress={() => router.push('/(tabs)/profile/reservations')}
        />
        <ProfileMenuRow
          icon="ticket-outline"
          label="Cupons"
          onPress={() => router.push('/(tabs)/profile/coupons')}
        />
        <ProfileMenuRow
          icon="document-text-outline"
          label="Informações de cobrança"
          onPress={() => router.push('/(tabs)/profile/billing')}
        />
        <ProfileMenuRow
          icon="settings-outline"
          label="Preferências e privacidade"
          onPress={() => router.push('/(tabs)/profile/settings')}
        />
        <ProfileMenuRow
          icon="trash-outline"
          label="Excluir conta"
          danger
          onPress={() =>
            Alert.alert(
              'Excluir conta',
              'Esta ação exigirá confirmação e uma nova autenticação antes de remover os dados.',
            )
          }
        />
        <ProfileMenuRow
          icon="log-out-outline"
          label="Sair"
          danger
          onPress={() => {
            void signOut().then(() => router.replace('/'));
          }}
        />
      </AppCard>
    </Screen>
  );
}

function ProfileMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 24, fontWeight: '900' },
  profileCopy: { flex: 1 },
  name: { fontSize: 23, fontWeight: '900' },
  email: { fontSize: 14, marginTop: 5 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metric: {
    width: '48%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    padding: 13,
  },
  metricValue: { fontSize: 17, fontWeight: '900', marginTop: 8 },
  metricLabel: { fontSize: 12, marginTop: 3 },
});
