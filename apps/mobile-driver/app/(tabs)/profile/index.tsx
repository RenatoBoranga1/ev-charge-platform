import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { ProfileMenuRow } from '@/components/ProfileMenuRow';
import { Screen } from '@/components/Screen';
import { Avatar, useFeedback } from '@/design-system';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatCurrency } from '@/utils/format';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.users.getMe(),
  });
  const deletion = useMutation({
    mutationFn: () => api.users.requestDeletion(profile.data?.recordVersion ?? 0),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['profile'], updated);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      setDeleteVisible(false);
      feedback.showSnackbar('Solicitação de exclusão registrada.');
    },
    onError: (error) => feedback.showToast(error.message, { tone: 'danger' }),
  });

  if (profile.isLoading) {
    return (
      <Screen>
        <LoadingState title="Carregando perfil" />
      </Screen>
    );
  }
  if (profile.isError) {
    return (
      <Screen>
        <ErrorState
          actionLabel="Tentar novamente"
          message={profile.error.message}
          onAction={() => void profile.refetch()}
          title="Não foi possível carregar seu perfil"
        />
      </Screen>
    );
  }
  if (!profile.data) return null;
  const user = profile.data;

  const location = [user.city, user.state, user.country].filter(Boolean).join(' · ');
  return (
    <Screen>
      <AppHeader
        actionLabel="Editar"
        onAction={() => router.push('/(tabs)/profile/edit')}
        title="Sua conta Solis"
      />
      <View
        accessibilityLabel={`Perfil de ${user.name}`}
        style={[
          styles.profile,
          {
            backgroundColor: colors.primaryContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <Avatar
          name={user.name}
          size={76}
          {...(user.avatarUrl ? { source: { uri: user.avatarUrl } } : {})}
        />
        <View style={styles.profileCopy}>
          <Text style={[styles.name, { color: colors.onPrimaryContainer }]}>{user.name}</Text>
          <Text style={[styles.email, { color: colors.onPrimaryContainer }]}>{user.email}</Text>
          {location ? (
            <Text style={[styles.location, { color: colors.onPrimaryContainer }]}>{location}</Text>
          ) : null}
          <View
            accessibilityLabel="Conta protegida"
            style={[styles.security, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="shield-checkmark-outline" color={colors.primary} size={15} />
            <Text style={[styles.securityText, { color: colors.text }]}>Conta protegida</Text>
          </View>
        </View>
      </View>

      <View style={styles.metrics}>
        <ProfileMetric
          icon="flash-outline"
          label="Energia"
          value={`${user.totalEnergyKwh.toFixed(1)} kWh`}
        />
        <ProfileMetric
          icon="leaf-outline"
          label="CO₂ evitado"
          value={`${user.avoidedCo2Kg.toFixed(1)} kg`}
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

      {user.accountDeletionRequestedAt ? (
        <AppCard>
          <Text accessibilityRole="alert" style={[styles.notice, { color: colors.danger }]}>
            Sua solicitação de exclusão está em análise. Seus dados não foram removidos
            automaticamente.
          </Text>
        </AppCard>
      ) : null}

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
          icon="settings-outline"
          label="Preferências e privacidade"
          onPress={() => router.push('/(tabs)/profile/settings')}
        />
        <ProfileMenuRow
          danger
          icon="trash-outline"
          label="Excluir conta"
          onPress={() => setDeleteVisible(true)}
        />
        <ProfileMenuRow
          danger
          icon="log-out-outline"
          label="Sair"
          onPress={() => {
            void signOut().then(() => router.replace('/'));
          }}
        />
      </AppCard>

      <ConfirmationDialog
        confirmLabel="Solicitar exclusão"
        loading={deletion.isPending}
        message="Esta etapa registra sua solicitação conforme a LGPD. A remoção definitiva exigirá confirmação de identidade."
        onCancel={() => setDeleteVisible(false)}
        onConfirm={() => deletion.mutate()}
        title="Excluir sua conta?"
        visible={deleteVisible}
      />
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
    <View
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 15,
    padding: 20,
  },
  profileCopy: { flex: 1 },
  name: { fontSize: 23, fontWeight: '900' },
  email: { fontSize: 14, marginTop: 5 },
  location: { fontSize: 12, marginTop: 4 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metric: {
    width: '48%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    padding: 13,
  },
  security: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  securityText: { fontSize: 11, fontWeight: '800' },
  metricValue: { fontSize: 17, fontWeight: '900', marginTop: 8 },
  metricLabel: { fontSize: 12, marginTop: 3 },
  notice: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
