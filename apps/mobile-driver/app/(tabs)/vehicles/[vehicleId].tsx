import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, LoadingState } from '@/components/AsyncState';
import { ConnectorBadge } from '@/components/ConnectorBadge';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function VehicleDetailsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const query = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.vehicles.list(),
  });
  const vehicle = query.data?.find((item) => item.id === vehicleId);

  if (query.isLoading) {
    return <Screen><LoadingState title="Carregando veículo" /></Screen>;
  }
  if (!vehicle) {
    return (
      <Screen>
        <AppHeader canGoBack title="Veículo" />
        <EmptyState title="Veículo não encontrado" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        canGoBack
        title={vehicle.brand + ' ' + vehicle.model}
        subtitle={vehicle.isDefault ? 'Veículo principal' : 'Veículo cadastrado'}
      />
      <AppCard>
        <Detail label="Motorização" value={vehicle.vehicleType === 'BEV' ? 'Elétrico' : 'Híbrido plug-in'} />
        <Detail label="Bateria" value={String(vehicle.batteryCapacityKwh) + ' kWh'} />
        <Detail label="Autonomia" value={String(vehicle.estimatedRangeKm ?? '—') + ' km'} />
        <Detail label="Ano" value={String(vehicle.year ?? '—')} />
        <Detail label="Versão" value={vehicle.version ?? 'Não informada'} />
        <Detail label="Placa" value={vehicle.licensePlate ?? 'Não informada'} />
        <View style={styles.plugs}>
          {vehicle.supportedPlugTypes.map((plug) => (
            <ConnectorBadge key={plug} plugType={plug} />
          ))}
        </View>
      </AppCard>
      <AppButton
        label="Editar veículo"
        onPress={() =>
          router.push({
            pathname: '/(tabs)/vehicles/edit-[vehicleId]',
            params: { vehicleId },
          })
        }
      />
      <AppButton
        label="Planejar viagem"
        variant="secondary"
        onPress={() => router.push('/(tabs)/trips/plan')}
      />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: { flex: 1, fontSize: 14 },
  value: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  plugs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
});
