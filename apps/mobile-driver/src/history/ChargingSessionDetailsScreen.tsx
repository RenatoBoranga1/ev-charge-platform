import { useQuery } from '@tanstack/react-query';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/design-system/Loading';
import { Tag } from '@/design-system/Indicators';
import { openExternalRoute } from '@/navigation/external-maps';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatDateTime, formatDuration, formatMoney } from '@/utils/format';

import { ChargingSessionEnergyChart, ChargingSessionTimeline } from './ChargingHistoryComponents';
import { chargingSessionKeys } from './query-keys';

export function ChargingSessionDetailsScreen({ sessionId }: { sessionId: string }) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const details = useQuery({
    enabled: Boolean(user && sessionId),
    queryFn: ({ signal }) => api.history.getDetails(sessionId, signal),
    queryKey: chargingSessionKeys.detail(userId, sessionId),
  });
  const timeline = useQuery({
    enabled: Boolean(user && sessionId),
    queryFn: ({ signal }) => api.history.getTimeline(sessionId, signal),
    queryKey: chargingSessionKeys.timeline(userId, sessionId),
  });
  const metrics = useQuery({
    enabled: Boolean(user && sessionId),
    queryFn: ({ signal }) => api.history.getMetrics(sessionId, 60, signal),
    queryKey: chargingSessionKeys.metrics(userId, sessionId),
  });

  if (details.isLoading) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader canGoBack title="Detalhes da recarga" />
        <Skeleton height={180} />
        <Skeleton height={220} />
        <Skeleton height={160} />
      </Screen>
    );
  }
  if (details.isError || !details.data) {
    return (
      <Screen>
        <AppHeader canGoBack title="Detalhes da recarga" />
        <ErrorState
          actionLabel="Tentar novamente"
          {...(details.error?.message ? { message: details.error.message } : {})}
          onAction={() => void details.refetch()}
          title="Não foi possível carregar a sessão"
        />
      </Screen>
    );
  }

  const session = details.data;
  const navigate = async () => {
    const result = await openExternalRoute({
      address: session.station.address,
      label: session.station.name,
      latitude: session.station.latitude,
      longitude: session.station.longitude,
    });
    if (!result.ok && result.code !== 'cancelled') {
      Alert.alert('Navegação indisponível', 'Não foi possível abrir o aplicativo de mapas.');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader canGoBack title="Detalhes da recarga" />
      <AppCard accessibilityLabel={`Sessão ${session.status}`}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.text }]}>{session.station.name}</Text>
            <Text style={{ color: colors.textMuted }}>
              {session.station.address} · {session.station.city}
            </Text>
          </View>
          <Tag
            label={session.status}
            tone={
              session.status === 'completed'
                ? 'success'
                : session.status === 'failed'
                  ? 'danger'
                  : 'info'
            }
          />
        </View>
        <Text style={[styles.identifier, { color: colors.textMuted }]}>Sessão {session.id}</Text>
      </AppCard>

      <AppCard accessibilityLabel="Resumo da sessão" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumo</Text>
        <DetailRow label="Início" value={formatDateTime(session.startedAt)} />
        <DetailRow
          label="Término"
          value={session.endedAt ? formatDateTime(session.endedAt) : 'Em andamento'}
        />
        <DetailRow label="Duração" value={formatDuration(session.durationSeconds)} />
        <DetailRow label="Energia" value={`${session.energyKwh.toFixed(3)} kWh`} />
        <DetailRow
          label="Veículo"
          value={`${session.vehicle.nickname} · ${session.vehicle.brand} ${session.vehicle.model}`}
        />
        <DetailRow label="Conector" value={session.connector.label} />
        <DetailRow label="Charge point" value={session.chargePoint.externalCode} />
        <DetailRow label="EVSE" value={session.evse.uid} />
        <DetailRow
          label="Medidor inicial"
          value={session.meter.startWh ? `${session.meter.startWh} Wh` : 'Indisponível'}
        />
        <DetailRow
          label="Medidor final"
          value={session.meter.stopWh ? `${session.meter.stopWh} Wh` : 'Indisponível'}
        />
        <DetailRow
          label="Potência máxima"
          value={
            session.power.maximumPowerKw === null
              ? 'Indisponível'
              : `${session.power.maximumPowerKw} kW`
          }
        />
        <DetailRow
          label="Potência média"
          value={
            session.power.averagePowerKw === null
              ? 'Indisponível'
              : `${session.power.averagePowerKw} kW`
          }
        />
        {session.cost ? (
          <DetailRow
            label="Custo"
            value={formatMoney(session.cost.amount, session.cost.currency)}
          />
        ) : null}
        {session.failureReason ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {session.failureReason}
          </Text>
        ) : null}
      </AppCard>

      {session.tariff ? (
        <AppCard accessibilityLabel="Tarifa aplicada" style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tarifa</Text>
          <DetailRow label="Nome" value={session.tariff.name} />
          <DetailRow
            label="Energia"
            value={formatMoney(session.tariff.pricePerKwh, session.tariff.currency) + '/kWh'}
          />
          <DetailRow
            label="Ativação"
            value={formatMoney(session.tariff.activationFee, session.tariff.currency)}
          />
        </AppCard>
      ) : null}

      <AppCard accessibilityLabel="Métricas da sessão" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Energia e potência</Text>
        {metrics.data ? (
          <ChargingSessionEnergyChart data={metrics.data} />
        ) : metrics.isError ? (
          <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>
            Métricas indisponíveis.
          </Text>
        ) : (
          <Skeleton height={100} />
        )}
      </AppCard>

      <AppCard accessibilityLabel="Linha do tempo da sessão" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Linha do tempo</Text>
        {timeline.data ? (
          <ChargingSessionTimeline data={timeline.data} />
        ) : timeline.isError ? (
          <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>
            Linha do tempo indisponível.
          </Text>
        ) : (
          <Skeleton height={150} />
        )}
      </AppCard>

      <AppCard accessibilityLabel="Auditoria permitida ao motorista" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Registro</Text>
        <DetailRow label="Criada em" value={formatDateTime(session.audit.createdAt)} />
        <DetailRow label="Atualizada em" value={formatDateTime(session.audit.updatedAt)} />
        <DetailRow label="Versão" value={String(session.audit.version)} />
      </AppCard>
      <AppButton label="Navegar até a estação" onPress={() => void navigate()} variant="outline" />
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.detailRow}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  content: { gap: 14 },
  detailRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  detailValue: { flex: 1, fontWeight: '700', textAlign: 'right' },
  flex: { flex: 1 },
  identifier: { fontSize: 12, marginTop: 12 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  title: { fontSize: 20, fontWeight: '900' },
});
