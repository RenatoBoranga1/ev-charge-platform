import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { ChargingMetricCard } from '@/components/ChargingMetricCard';
import { ChargingProgress } from '@/components/ChargingProgress';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Screen } from '@/components/Screen';
import { invalidateChargingHistory } from '@/history/query-keys';
import { chargingRealtimeClient } from '@/realtime';
import type { ChargingConnectionState } from '@/realtime/ChargingRealtimeClient';
import { useChargingStore } from '@/stores/charging-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import { estimateAvoidedCo2 } from '@/utils/charging';
import { formatCurrency, formatDateTime, formatDuration } from '@/utils/format';

export default function ActiveChargeScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const activeSession = useChargingStore((state) => state.activeSession);
  const activeSessionId = activeSession?.id;
  const applyRealtimeEvent = useChargingStore((state) => state.applyRealtimeEvent);
  const setSummary = useChargingStore((state) => state.setSummary);
  const setActiveSession = useChargingStore((state) => state.setActiveSession);
  const [confirmStop, setConfirmStop] = useState(false);
  const [connectionState, setConnectionState] = useState<ChargingConnectionState>('disconnected');
  const stopIdempotencyKey = useRef('mobile-stop-' + (activeSessionId ?? 'recovered'));
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [powerSamples, setPowerSamples] = useState<number[]>([]);
  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.vehicles.list(),
  });
  const recovery = useQuery({
    enabled: !activeSession,
    queryKey: ['charging-session', 'active'],
    queryFn: () => api.charging.getActive(),
    retry: 2,
  });
  const metrics = useQuery({
    enabled: Boolean(activeSessionId),
    queryKey: ['charging-session', activeSessionId, 'metrics'],
    queryFn: () => api.charging.getMetrics(activeSessionId!),
    refetchInterval: 5_000,
    retry: 2,
  });
  const vehicle = vehicles.data?.find((item) => item.id === activeSession?.vehicleId);
  const stopMutation = useMutation({
    mutationFn: () => {
      if (!activeSession) throw new Error('Sessão ativa não encontrada.');
      return api.charging.stop(activeSession.id, stopIdempotencyKey.current);
    },
    onSuccess: (summary) => {
      chargingRealtimeClient.disconnect();
      setSummary(summary);
      setConfirmStop(false);
      router.replace('/(tabs)/charge/completed');
      if (user) {
        void invalidateChargingHistory(queryClient, user.id, summary.session.id);
      }
    },
  });

  useEffect(() => {
    if (recovery.data) setActiveSession(recovery.data);
  }, [recovery.data, setActiveSession]);

  useEffect(() => {
    if (metrics.data) applyRealtimeEvent(metrics.data);
  }, [applyRealtimeEvent, metrics.data]);

  useEffect(() => {
    if (!activeSessionId) return undefined;

    const unsubscribeConnection = chargingRealtimeClient.subscribeConnection((state) => {
      setConnectionState(state);
      if (state === 'connected') setRealtimeError(null);
    });
    const unsubscribeError = chargingRealtimeClient.subscribeError(setRealtimeError);
    const unsubscribe = chargingRealtimeClient.subscribe((event) => {
      applyRealtimeEvent(event);
      setPowerSamples((samples) => [...samples.slice(-11), event.currentPowerKw]);
    });
    void chargingRealtimeClient
      .connect(activeSessionId)
      .catch((error: unknown) =>
        setRealtimeError(
          error instanceof Error ? error.message : 'Falha nas atualizações em tempo real.',
        ),
      );

    return () => {
      unsubscribe();
      unsubscribeConnection();
      unsubscribeError();
      chargingRealtimeClient.disconnect();
    };
  }, [activeSessionId, applyRealtimeEvent]);

  if (!activeSession && recovery.isLoading) {
    return (
      <Screen>
        <AppHeader title="Sessao ativa" />
        <LoadingState title="Recuperando sessao em andamento" />
      </Screen>
    );
  }

  if (!activeSession && recovery.isError) {
    return (
      <Screen>
        <AppHeader title="Sessao ativa" />
        <ErrorState
          title="Nao foi possivel recuperar a sessao"
          message={recovery.error.message}
          actionLabel="Tentar novamente"
          onAction={() => void recovery.refetch()}
        />
      </Screen>
    );
  }

  if (!activeSession) {
    return (
      <Screen>
        <AppHeader title="Sessão ativa" />
        <EmptyState
          title="Nenhuma recarga em andamento"
          actionLabel="Iniciar recarga"
          onAction={() => router.replace('/(tabs)/charge')}
        />
      </Screen>
    );
  }

  const chartSamples =
    powerSamples.length > 0
      ? powerSamples
      : activeSession.currentPowerKw > 0
        ? [activeSession.currentPowerKw]
        : [];
  const maximumPower = chartSamples.length > 0 ? Math.max(...chartSamples) : 0;
  const minimumPower = chartSamples.length > 0 ? Math.min(...chartSamples) : 0;
  const measurementLabel = `${chartSamples.length} ${
    chartSamples.length === 1 ? 'medição' : 'medições'
  }`;
  const connectionLabel =
    connectionState === 'connected'
      ? 'Conectado'
      : connectionState === 'reconnecting'
        ? 'Reconectando'
        : 'Sem conexão em tempo real';

  return (
    <Screen>
      <AppHeader
        title="Recarga em andamento"
        subtitle={activeSession.stationName + ' · ' + activeSession.connectorLabel}
      />
      <View
        accessibilityLabel={`Status da recarga: carregando. Atualizações: ${connectionLabel}.`}
        accessibilityLiveRegion="polite"
        style={[
          styles.status,
          {
            backgroundColor: colors.primaryContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.statusMain}>
          <View style={[styles.statusIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="flash" color={colors.primary} size={24} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusText, { color: colors.onPrimaryContainer }]}>
              Carregando com segurança
            </Text>
            <Text style={[styles.statusSubtitle, { color: colors.onPrimaryContainer }]}>
              {activeSession.stationName} · {activeSession.connectorLabel}
            </Text>
          </View>
        </View>
        <View style={styles.connection}>
          <View
            style={[
              styles.connectionDot,
              {
                backgroundColor: connectionState === 'connected' ? colors.success : colors.warning,
              },
            ]}
          />
          <Text style={[styles.connectionText, { color: colors.onPrimaryContainer }]}>
            {connectionLabel}
          </Text>
        </View>
      </View>
      {realtimeError ? (
        <Text accessibilityRole="alert" style={[styles.offline, { color: colors.warning }]}>
          {realtimeError} Os últimos dados conhecidos continuam visíveis.
        </Text>
      ) : null}
      {realtimeError ? (
        <AppButton
          label="Tentar reconectar"
          variant="outline"
          onPress={() =>
            void chargingRealtimeClient
              .reconnect()
              .catch((error: unknown) =>
                setRealtimeError(error instanceof Error ? error.message : 'Falha na reconexao.'),
              )
          }
        />
      ) : null}

      <ChargingProgress
        label="Bateria estimada"
        percent={activeSession.estimatedBatteryPercent ?? 0}
      />
      <AppCard accessibilityLabel="Fluxo de recarga: energia, carregador e veículo">
        <Text style={[styles.flowTitle, { color: colors.text }]}>Fluxo de recarga</Text>
        <View style={styles.energyFlow}>
          <FlowNode icon="flash-outline" label="Energia" />
          <Ionicons
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            name="arrow-forward"
            color={colors.chartPrimary}
            size={20}
          />
          <FlowNode icon="git-network-outline" label="Carregador" />
          <Ionicons
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            name="arrow-forward"
            color={colors.chartSecondary}
            size={20}
          />
          <FlowNode icon="car-sport-outline" label="Veículo" />
        </View>
        <Text style={[styles.flowCaption, { color: colors.textMuted }]}>
          A origem da energia não é inferida pela sessão.
        </Text>
      </AppCard>

      <View style={styles.metrics}>
        <ChargingMetricCard label="Tempo" value={formatDuration(activeSession.elapsedSeconds)} />
        <ChargingMetricCard label="Energia" value={activeSession.energyKwh.toFixed(2)} unit="kWh" />
        <ChargingMetricCard
          label="Potência"
          value={activeSession.currentPowerKw.toFixed(1)}
          unit="kW"
        />
        <ChargingMetricCard
          label="Custo estimado"
          value={formatCurrency(activeSession.estimatedCost)}
        />
      </View>

      <AppCard accessibilityLabel="Potência recente da sessão">
        <Text style={[styles.chartTitle, { color: colors.text }]}>Potência recente</Text>
        {chartSamples.length > 0 ? (
          <>
            <View
              accessibilityLabel={`Gráfico de potência com ${measurementLabel}. Mínima ${minimumPower.toFixed(
                1,
              )} quilowatts e máxima ${maximumPower.toFixed(1)} quilowatts.`}
              accessible
              accessibilityRole="image"
              style={[
                styles.chart,
                {
                  borderBottomColor: colors.chartGrid,
                  borderTopColor: colors.chartGrid,
                },
              ]}
            >
              {chartSamples.map((sample, index) => (
                <View
                  key={String(index) + '-' + String(sample)}
                  style={[
                    styles.bar,
                    {
                      height: 14 + (sample / Math.max(1, maximumPower)) * 76,
                      backgroundColor: colors.chartPrimary,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.chartSummary, { color: colors.chartAxis }]}>
              Mín. {minimumPower.toFixed(1)} kW · Atual {activeSession.currentPowerKw.toFixed(1)} kW
              · Máx. {maximumPower.toFixed(1)} kW
            </Text>
          </>
        ) : (
          <Text style={[styles.chartEmpty, { color: colors.textMuted }]}>
            Aguardando a primeira medição de potência.
          </Text>
        )}
      </AppCard>

      <AppCard>
        <Text style={[styles.impactTitle, { color: colors.text }]}>Impacto desta sessão</Text>
        <Text style={[styles.impactValue, { color: colors.success }]}>
          {estimateAvoidedCo2(activeSession.energyKwh).toFixed(2)} kg de CO₂ evitados
        </Text>
        <Text style={[styles.tariff, { color: colors.textMuted }]}>
          Tarifa de {formatCurrency(activeSession.tariffPerKwh)}/kWh
          {vehicle ? ' · ' + vehicle.brand + ' ' + vehicle.model : ''}
        </Text>
        {activeSession.estimatedEndAt ? (
          <Text style={[styles.tariff, { color: colors.textMuted }]}>
            Conclusão prevista: {formatDateTime(activeSession.estimatedEndAt)}
          </Text>
        ) : null}
      </AppCard>

      <AppButton label="Encerrar recarga" variant="danger" onPress={() => setConfirmStop(true)} />
      <View style={styles.secondaryActions}>
        <View style={styles.secondaryAction}>
          <AppButton
            label="Ver localização"
            variant="outline"
            onPress={() => router.push('/(tabs)/stations')}
          />
        </View>
        <View style={styles.secondaryAction}>
          <AppButton
            label="Ajuda"
            variant="outline"
            onPress={() => Alert.alert('Ajuda Solis', 'Atendimento mock disponível 24 horas.')}
          />
        </View>
      </View>
      <AppButton
        label="Reportar problema"
        variant="ghost"
        onPress={() => router.push('/(tabs)/profile/support')}
      />

      <ConfirmationDialog
        visible={confirmStop}
        title="Deseja encerrar a recarga?"
        message="O valor final será calculado com base na energia consumida e nas tarifas da estação."
        confirmLabel="Encerrar agora"
        loading={stopMutation.isPending}
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => stopMutation.mutate()}
      />
      {stopMutation.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {stopMutation.error.message}
        </Text>
      ) : null}
    </Screen>
  );
}

function FlowNode({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel={label} style={styles.flowNode}>
      <View style={[styles.flowIcon, { backgroundColor: colors.primaryContainer }]}>
        <Ionicons name={icon} color={colors.primary} size={22} />
      </View>
      <Text style={[styles.flowLabel, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: 4, flex: 1, minWidth: 6 },
  chart: {
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    height: 108,
    marginTop: 14,
    paddingTop: 8,
  },
  chartEmpty: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  chartSummary: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  chartTitle: { fontSize: 16, fontWeight: '800' },
  connection: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  connectionDot: { borderRadius: 5, height: 10, width: 10 },
  connectionText: { fontSize: 12, fontWeight: '800' },
  energyFlow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    marginTop: 16,
  },
  flowCaption: { fontSize: 12, lineHeight: 18, marginTop: 14 },
  flowIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  flowLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  flowNode: { alignItems: 'center', flex: 1, gap: 6 },
  flowTitle: { fontSize: 16, fontWeight: '900' },
  impactTitle: { fontSize: 15, fontWeight: '800' },
  impactValue: { fontSize: 20, fontWeight: '900', marginTop: 7 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  offline: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  secondaryAction: { flex: 1 },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  status: {
    alignItems: 'stretch',
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    minHeight: 104,
    padding: 16,
  },
  statusCopy: { flex: 1, gap: 3 },
  statusIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  statusMain: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  statusSubtitle: { fontSize: 12, lineHeight: 17 },
  statusText: { fontSize: 15, fontWeight: '900' },
  tariff: { fontSize: 13, marginTop: 7 },
});
