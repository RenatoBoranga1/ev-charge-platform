import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { ChargingMetricCard } from '@/components/ChargingMetricCard';
import { ChargingProgress } from '@/components/ChargingProgress';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Screen } from '@/components/Screen';
import { chargingRealtimeClient } from '@/realtime';
import type { ChargingConnectionState } from '@/realtime/ChargingRealtimeClient';
import { useChargingStore } from '@/stores/charging-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import { estimateAvoidedCo2 } from '@/utils/charging';
import { formatCurrency, formatDateTime, formatDuration } from '@/utils/format';

export default function ActiveChargeScreen() {
  const { colors } = useAppTheme();
  const activeSession = useChargingStore((state) => state.activeSession);
  const activeSessionId = activeSession?.id;
  const applyRealtimeEvent = useChargingStore((state) => state.applyRealtimeEvent);
  const setSummary = useChargingStore((state) => state.setSummary);
  const setActiveSession = useChargingStore((state) => state.setActiveSession);
  const [confirmStop, setConfirmStop] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ChargingConnectionState>('disconnected');
  const stopIdempotencyKey = useRef(
    'mobile-stop-' + (activeSessionId ?? 'recovered'),
  );
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [powerSamples, setPowerSamples] = useState<number[]>([68, 71, 73, 72, 74]);
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
      return api.charging.stop(
        activeSession.id,
        stopIdempotencyKey.current,
      );
    },
    onSuccess: (summary) => {
      chargingRealtimeClient.disconnect();
      setSummary(summary);
      setConfirmStop(false);
      router.replace('/(tabs)/charge/completed');
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

    const unsubscribeConnection =
      chargingRealtimeClient.subscribeConnection((state) => {
        setConnectionState(state);
        if (state === 'connected') setRealtimeError(null);
      });
    const unsubscribeError =
      chargingRealtimeClient.subscribeError(setRealtimeError);
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

  return (
    <Screen>
      <AppHeader
        title="Recarga em andamento"
        subtitle={activeSession.stationName + ' · ' + activeSession.connectorLabel}
      />
      <View style={[styles.status, { backgroundColor: colors.primary }]}>
        <Ionicons name="flash" color={colors.onPrimary} size={22} />
        <Text style={[styles.statusText, { color: colors.onPrimary }]}>
          Carregando com segurança
        </Text>
      </View>
      {connectionState === 'reconnecting' ? (
        <Text accessibilityLiveRegion="polite" style={[styles.offline, { color: colors.warning }]}>
          Reconectando atualizacoes em tempo real...
        </Text>
      ) : null}
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
            void chargingRealtimeClient.reconnect().catch((error: unknown) =>
              setRealtimeError(
                error instanceof Error ? error.message : 'Falha na reconexao.',
              ),
            )
          }
        />
      ) : null}

      <ChargingProgress
        label="Bateria estimada"
        percent={activeSession.estimatedBatteryPercent ?? 0}
      />
      <View style={styles.metrics}>
        <ChargingMetricCard
          label="Tempo"
          value={formatDuration(activeSession.elapsedSeconds)}
        />
        <ChargingMetricCard
          label="Energia"
          value={activeSession.energyKwh.toFixed(2)}
          unit="kWh"
        />
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

      <AppCard>
        <Text style={[styles.chartTitle, { color: colors.text }]}>
          Potência recente
        </Text>
        <View accessibilityLabel="Gráfico de potência recente" style={styles.chart}>
          {powerSamples.map((sample, index) => (
            <View
              key={String(index) + '-' + String(sample)}
              style={[
                styles.bar,
                {
                  height: Math.max(14, Math.min(90, sample)),
                  backgroundColor: colors.secondary,
                },
              ]}
            />
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.impactTitle, { color: colors.text }]}>
          Impacto desta sessão
        </Text>
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

      <AppButton
        label="Encerrar recarga"
        variant="danger"
        onPress={() => setConfirmStop(true)}
      />
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

const styles = StyleSheet.create({
  status: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: { fontSize: 15, fontWeight: '900' },
  offline: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chartTitle: { fontSize: 16, fontWeight: '800' },
  chart: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 14,
  },
  bar: { flex: 1, minWidth: 6, borderRadius: 4 },
  impactTitle: { fontSize: 15, fontWeight: '800' },
  impactValue: { fontSize: 20, fontWeight: '900', marginTop: 7 },
  tariff: { fontSize: 13, marginTop: 7 },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  secondaryAction: { flex: 1 },
});
