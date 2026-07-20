import { useQuery } from '@tanstack/react-query';
import { Alert, StyleSheet, Text } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';
import { formatDateTime } from '@/utils/format';

export default function ReservationsScreen() {
  const { colors } = useAppTheme();
  const query = useQuery({
    queryKey: ['reservations'],
    queryFn: () => api.stations.listReservations(),
  });

  return (
    <Screen>
      <AppHeader canGoBack title="Reservas" />
      {query.isLoading ? (
        <LoadingState title="Carregando reservas" />
      ) : query.data?.length ? (
        query.data.map((reservation) => (
          <AppCard key={reservation.id}>
            <Text style={[styles.title, { color: colors.text }]}>{reservation.stationName}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{reservation.connectorLabel}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{formatDateTime(reservation.startsAt)}</Text>
            <AppButton
              label="Cancelar reserva"
              variant="outline"
              onPress={() => Alert.alert('Cancelamento mock', 'A reserva seria cancelada conforme a política exibida.')}
            />
          </AppCard>
        ))
      ) : (
        <EmptyState title="Nenhuma reserva ativa" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800' },
  body: { marginTop: 6, fontSize: 14 },
});
