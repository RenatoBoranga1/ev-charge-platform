import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { paymentKeys } from '@/payments/query-keys';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatDateTime, formatDuration, formatMinorMoney } from '@/utils/format';

export default function ReceiptScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const userId = user?.id ?? 'anonymous';
  const receipt = useQuery({
    queryKey: paymentKeys.receipt(userId, sessionId),
    queryFn: () => api.payments.getReceipt(sessionId),
    enabled: Boolean(user && sessionId),
  });

  if (receipt.isLoading) return <Screen><LoadingState title="Carregando recibo" /></Screen>;
  if (receipt.isError) {
    return (
      <Screen>
        <ErrorState
          actionLabel="Tentar novamente"
          message={receipt.error.message}
          onAction={() => void receipt.refetch()}
          title="Não foi possível carregar o recibo"
        />
      </Screen>
    );
  }
  if (!receipt.data) return null;
  const data = receipt.data;

  return (
    <Screen>
      <AppHeader canGoBack title="Recibo de recarga" />
      <View
        accessibilityLabel={`Recibo ${data.receiptNumber}, ${formatMinorMoney(
          data.amountMinor,
          data.currency,
        )}`}
        style={[styles.hero, { backgroundColor: colors.primaryContainer }]}
      >
        <Text style={[styles.number, { color: colors.onPrimaryContainer }]}>
          {data.receiptNumber}
        </Text>
        <Text style={[styles.amount, { color: colors.onPrimaryContainer }]}>
          {formatMinorMoney(data.amountMinor, data.currency)}
        </Text>
        <Text style={[styles.status, { color: colors.onPrimaryContainer }]}>{data.status}</Text>
      </View>
      <AppCard style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>Sessão</Text>
        <Detail label="Estação" value={data.chargingSession.station} />
        <Detail label="Conector" value={data.chargingSession.connector} />
        <Detail
          label="Veículo"
          value={`${data.chargingSession.vehicle.brand} ${data.chargingSession.vehicle.model}${
            data.chargingSession.vehicle.plate ? ` · ${data.chargingSession.vehicle.plate}` : ''
          }`}
        />
        <Detail label="Energia" value={`${data.chargingSession.energyKwh} kWh`} />
        <Detail label="Duração" value={formatDuration(data.chargingSession.durationSeconds)} />
        {data.chargingSession.startedAt ? (
          <Detail label="Início" value={formatDateTime(data.chargingSession.startedAt)} />
        ) : null}
        {data.chargingSession.completedAt ? (
          <Detail label="Conclusão" value={formatDateTime(data.chargingSession.completedAt)} />
        ) : null}
      </AppCard>
      <AppCard style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>Pagamento</Text>
        <Detail label="Método" value={data.payment.method} />
        <Detail label="Status" value={data.payment.status} />
        <Detail label="Emitido em" value={formatDateTime(data.issuedAt)} />
        {data.payment.reference ? <Detail label="Referência" value={data.payment.reference} /> : null}
      </AppCard>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Este recibo apresenta dados de pagamento mascarados. A Solis não expõe tokens,
        credenciais ou dados completos de cartão.
      </Text>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.detail}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', borderRadius: 24, padding: 24 },
  number: { fontSize: 13, fontWeight: '800' },
  amount: { fontSize: 32, fontWeight: '900', marginTop: 10 },
  status: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  card: { gap: 11 },
  title: { fontSize: 18, fontWeight: '900' },
  detail: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  detailValue: { flex: 1, fontWeight: '700', textAlign: 'right' },
  note: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
