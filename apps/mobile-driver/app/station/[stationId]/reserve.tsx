import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function ReserveStationScreen() {
  const { stationId } = useLocalSearchParams<{ stationId: string }>();
  const { colors } = useAppTheme();
  const stationQuery = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => api.stations.getById(stationId),
  });
  const availableConnectors =
    stationQuery.data?.connectors.filter((connector) => connector.status === 'AVAILABLE') ?? [];
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => {
      const selected = connectorId ?? availableConnectors[0]?.id;
      if (!selected) throw new Error('Nenhum conector disponível.');
      return api.stations.createReservation(stationId, selected);
    },
  });

  if (stationQuery.isLoading) {
    return <Screen><LoadingState title="Verificando agenda" /></Screen>;
  }
  if (stationQuery.isError || !stationQuery.data) {
    return <Screen><ErrorState title="Não foi possível reservar" /></Screen>;
  }

  if (mutation.data) {
    return (
      <Screen>
        <AppHeader title="Reserva confirmada" />
        <AppCard>
          <Text style={[styles.successTitle, { color: colors.success }]}>
            Seu horário está protegido
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>
            {mutation.data.stationName}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {mutation.data.connectorLabel}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Início previsto em 1 hora. A tolerância do mock é de 15 minutos.
          </Text>
        </AppCard>
        <AppButton
          label="Voltar ao mapa"
          onPress={() => router.replace('/(tabs)/stations')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        canGoBack
        title="Reservar recarga"
        subtitle={stationQuery.data.name}
      />
      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Escolha um conector
        </Text>
        <View style={styles.chips}>
          {availableConnectors.map((connector) => (
            <FilterChip
              key={connector.id}
              label={connector.plugType + ' · ' + String(connector.maximumPowerKw) + ' kW'}
              selected={(connectorId ?? availableConnectors[0]?.id) === connector.id}
              onPress={() => setConnectorId(connector.id)}
            />
          ))}
        </View>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Horário mock: hoje, daqui a 1 hora. A versão de agenda completa depende do backend.
        </Text>
      </AppCard>
      {mutation.error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {mutation.error.message}
        </Text>
      ) : null}
      <AppButton
        label="Confirmar reserva"
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  successTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12 },
});
