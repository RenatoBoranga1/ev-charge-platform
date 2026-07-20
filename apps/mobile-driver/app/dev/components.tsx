import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { ChargingMetricCard } from '@/components/ChargingMetricCard';
import { ConnectorBadge } from '@/components/ConnectorBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { FilterChip } from '@/components/FilterChip';
import { PaymentMethodCard } from '@/components/PaymentMethodCard';
import { Screen } from '@/components/Screen';
import { StationPreviewCard } from '@/components/StationPreviewCard';
import { VehicleCard } from '@/components/VehicleCard';
import { mockPaymentMethods, mockStations, mockVehicles } from '@/mocks/data';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function ComponentsCatalogScreen() {
  const { colors } = useAppTheme();

  return (
    <Screen>
      <AppHeader canGoBack title="Catálogo de componentes" subtitle="Rota interna de desenvolvimento" />
      <Text style={[styles.title, { color: colors.text }]}>Botões e campos</Text>
      <AppButton label="Ação principal" onPress={() => undefined} />
      <AppButton label="Ação secundária" variant="secondary" onPress={() => undefined} />
      <AppButton label="Contorno" variant="outline" onPress={() => undefined} />
      <AppTextField label="Campo de exemplo" placeholder="Digite algo" />
      <View style={styles.row}>
        <FilterChip label="Disponível" selected onPress={() => undefined} />
        <ConnectorBadge plugType="CCS2" powerKw={150} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Domínio</Text>
      <StationPreviewCard
        station={mockStations[0]!}
        onDetails={() => undefined}
        onReserve={() => undefined}
        onRoute={() => undefined}
      />
      <VehicleCard vehicle={mockVehicles[0]!} onPress={() => undefined} />
      <PaymentMethodCard method={mockPaymentMethods[0]!} onPress={() => undefined} />
      <View style={styles.row}>
        <ChargingMetricCard label="Potência" value="72,4" unit="kW" />
        <ChargingMetricCard label="Energia" value="18,2" unit="kWh" />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Estados</Text>
      <AppCard><LoadingState title="Carregando exemplo" /></AppCard>
      <AppCard><EmptyState title="Estado vazio" /></AppCard>
      <AppCard><ErrorState title="Estado de erro" /></AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '900', marginTop: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
});
