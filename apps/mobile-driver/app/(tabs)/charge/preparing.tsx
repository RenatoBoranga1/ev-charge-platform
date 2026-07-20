import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, LoadingState } from '@/components/AsyncState';
import { PaymentMethodCard } from '@/components/PaymentMethodCard';
import { Screen } from '@/components/Screen';
import { VehicleCard } from '@/components/VehicleCard';
import { useChargingStore } from '@/stores/charging-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatCurrency } from '@/utils/format';

const startSteps = [
  'Verificando conector',
  'Validando pagamento',
  'Comunicando com o carregador',
  'Aguardando confirmação',
] as const;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('O carregador não respondeu dentro do prazo.')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default function PreparingChargeScreen() {
  const { colors } = useAppTheme();
  const {
    validatedConnector,
    selectedVehicleId,
    selectedPaymentMethodId,
    selectVehicle,
    selectPaymentMethod,
    setActiveSession,
  } = useChargingStore();
  const instanceId = useId();
  const idempotencyKey = useRef('mobile-' + instanceId);
  const [stepIndex, setStepIndex] = useState(0);
  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.vehicles.list(),
  });
  const payments = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.payments.list(),
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (!validatedConnector || !selectedVehicleId || !selectedPaymentMethodId) {
        throw new Error('Selecione veículo e pagamento antes de iniciar.');
      }
      return withTimeout(
        api.charging.start({
          validatedConnector,
          vehicleId: selectedVehicleId,
          paymentMethodId: selectedPaymentMethodId,
          idempotencyKey: idempotencyKey.current,
        }),
        15_000,
      );
    },
    onMutate: () => setStepIndex(0),
    onSuccess: (session) => {
      setActiveSession(session);
      router.replace('/(tabs)/charge/active');
    },
  });

  useEffect(() => {
    const defaultVehicle = vehicles.data?.find((vehicle) => vehicle.isDefault);
    if (!selectedVehicleId && defaultVehicle) selectVehicle(defaultVehicle.id);
  }, [selectVehicle, selectedVehicleId, vehicles.data]);

  useEffect(() => {
    const defaultPayment = payments.data?.find((payment) => payment.isDefault);
    if (!selectedPaymentMethodId && defaultPayment) {
      selectPaymentMethod(defaultPayment.id);
    }
  }, [payments.data, selectPaymentMethod, selectedPaymentMethodId]);

  useEffect(() => {
    if (!mutation.isPending) return undefined;
    const timer = setInterval(
      () => setStepIndex((current) => Math.min(current + 1, startSteps.length - 1)),
      650,
    );
    return () => clearInterval(timer);
  }, [mutation.isPending]);

  if (!validatedConnector) {
    return (
      <Screen>
        <AppHeader canGoBack title="Preparar recarga" />
        <EmptyState
          title="Nenhum conector validado"
          message="Leia um QR Code ou informe o código do equipamento."
          actionLabel="Abrir scanner"
          onAction={() => router.replace('/(tabs)/charge/scanner')}
        />
      </Screen>
    );
  }

  if (vehicles.isLoading || payments.isLoading) {
    return <Screen><LoadingState title="Preparando opções" /></Screen>;
  }

  return (
    <Screen>
      <AppHeader canGoBack title="Revise antes de iniciar" />
      <AppCard>
        <Text style={[styles.stationName, { color: colors.text }]}>
          {validatedConnector.station.name}
        </Text>
        <Text style={[styles.address, { color: colors.textMuted }]}>
          {validatedConnector.station.address}
        </Text>
        <InfoRow label="Conector" value={validatedConnector.connector.code} />
        <InfoRow
          label="Plugue e potência"
          value={
            validatedConnector.connector.plugType +
            ' · até ' +
            String(validatedConnector.connector.maximumPowerKw) +
            ' kW'
          }
        />
        <InfoRow
          label="Tarifa"
          value={formatCurrency(validatedConnector.station.pricePerKwh) + '/kWh'}
        />
        <InfoRow
          label="Pré-autorização mock"
          value={formatCurrency(validatedConnector.estimatedPreauthorization)}
        />
      </AppCard>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Veículo</Text>
      {vehicles.data?.map((vehicle) => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          selected={selectedVehicleId === vehicle.id}
          onPress={() => selectVehicle(vehicle.id)}
        />
      ))}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Pagamento</Text>
      {payments.data?.map((payment) => (
        <PaymentMethodCard
          key={payment.id}
          method={payment}
          selected={selectedPaymentMethodId === payment.id}
          onPress={() => selectPaymentMethod(payment.id)}
        />
      ))}

      <Text style={[styles.terms, { color: colors.textMuted }]}>
        Ao iniciar, você autoriza a pré-autorização mock e concorda com a tarifa apresentada. O valor final usa a energia efetivamente registrada.
      </Text>

      {mutation.isPending ? (
        <AppCard>
          {startSteps.map((step, index) => (
            <View key={step} style={styles.progressRow}>
              <Text style={{ color: index <= stepIndex ? colors.primary : colors.textMuted }}>
                {index < stepIndex ? '✓' : index === stepIndex ? '●' : '○'}
              </Text>
              <Text
                style={[
                  styles.progressText,
                  { color: index <= stepIndex ? colors.text : colors.textMuted },
                ]}
              >
                {step}
              </Text>
            </View>
          ))}
        </AppCard>
      ) : null}

      {mutation.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: '700' }}>
          {mutation.error.message}
        </Text>
      ) : null}

      <AppButton
        label="Iniciar recarga"
        disabled={!selectedVehicleId || !selectedPaymentMethodId}
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
      />
      <AppButton
        label="Cancelar"
        variant="ghost"
        disabled={mutation.isPending}
        onPress={() => router.replace('/(tabs)/stations')}
      />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stationName: { fontSize: 22, fontWeight: '900' },
  address: { fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 10 },
  infoRow: {
    minHeight: 45,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoLabel: { flex: 1, fontSize: 13 },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginTop: 12 },
  terms: { fontSize: 13, lineHeight: 19 },
  progressRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { fontSize: 14, fontWeight: '700' },
});
