import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { ChargingMetricCard } from '@/components/ChargingMetricCard';
import { ConnectorBadge } from '@/components/ConnectorBadge';
import { isDevelopmentCatalogEnabled } from '@/config/runtime';
import {
  AppBar,
  Avatar,
  Badge,
  BottomSheet,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FAB,
  Loading,
  LoadingState,
  NavigationBar,
  OutlinedButton,
  PrimaryButton,
  SearchBar,
  SecondaryButton,
  Skeleton,
  Surface,
  Tag,
  useFeedback,
} from '@/design-system';
import { PaymentMethodCard } from '@/components/PaymentMethodCard';
import { Screen } from '@/components/Screen';
import { StationPreviewCard } from '@/components/StationPreviewCard';
import { VehicleCard } from '@/components/VehicleCard';
import { mockPaymentMethods, mockStations, mockVehicles } from '@/mocks/data';
import { useAppTheme } from '@/theme/ThemeProvider';

const navigationItems = [
  { key: 'stations', label: 'Estações', icon: 'location-outline' as const },
  {
    key: 'charge',
    label: 'Recarga',
    icon: 'flash-outline' as const,
    selectedIcon: 'flash' as const,
  },
  { key: 'profile', label: 'Perfil', icon: 'person-outline' as const },
];

export default function ComponentsCatalogScreen() {
  const { colors, typeScale } = useAppTheme();
  const feedback = useFeedback();
  const [query, setQuery] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [navigationKey, setNavigationKey] = useState('charge');

  if (!isDevelopmentCatalogEnabled()) return <Redirect href="/" />;

  return (
    <Screen>
      <AppHeader
        canGoBack
        title="Catálogo de componentes"
        subtitle="Rota interna disponível somente em desenvolvimento"
      />

      <Text style={[typeScale.titleLarge, { color: colors.text }]}>
        Ações e campos
      </Text>
      <PrimaryButton label="Ação principal" onPress={() => undefined} />
      <SecondaryButton label="Ação secundária" onPress={() => undefined} />
      <OutlinedButton label="Ação contornada" onPress={() => undefined} />
      <AppTextField label="Campo de exemplo" placeholder="Digite algo" />
      <SearchBar
        onChangeText={setQuery}
        placeholder="Pesquisar no catálogo"
        value={query}
      />

      <Text style={[typeScale.titleLarge, { color: colors.text }]}>
        Superfícies e indicadores
      </Text>
      <Surface elevation="level1" rounded style={styles.surface}>
        <Text style={[typeScale.bodyMedium, { color: colors.text }]}>
          Surface com elevação semântica
        </Text>
      </Surface>
      <Card variant="filled">
        <View style={styles.row}>
          <Chip label="Disponível" selected onPress={() => undefined} />
          <Tag label="150 kW" tone="success" />
          <Badge value={3} />
          <Avatar name="Julio Greca" />
        </View>
      </Card>
      <View style={styles.skeletons}>
        <Skeleton width="35%" />
        <Skeleton height={72} />
      </View>
      <Loading label="Sincronizando estações" />

      <Text style={[typeScale.titleLarge, { color: colors.text }]}>
        Feedback e sobreposições
      </Text>
      <View style={styles.row}>
        <OutlinedButton
          label="Snackbar"
          onPress={() =>
            feedback.showSnackbar('Estação adicionada aos favoritos', {
              actionLabel: 'Desfazer',
            })
          }
        />
        <OutlinedButton
          label="Toast"
          onPress={() =>
            feedback.showToast('Preferências salvas', { tone: 'success' })
          }
        />
        <OutlinedButton
          label="Bottom sheet"
          onPress={() => setSheetVisible(true)}
        />
      </View>
      <FAB
        accessibilityLabel="Adicionar veículo"
        extendedLabel="Novo veículo"
        icon="add"
        onPress={() => undefined}
      />

      <Text style={[typeScale.titleLarge, { color: colors.text }]}>
        Navegação
      </Text>
      <AppBar overline="SOLIS" title="Estações próximas" subtitle="12 disponíveis" />
      <NavigationBar
        activeKey={navigationKey}
        items={navigationItems}
        onSelect={setNavigationKey}
      />

      <Text style={[typeScale.titleLarge, { color: colors.text }]}>Domínio</Text>
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
        <ConnectorBadge plugType="CCS2" powerKw={150} />
      </View>

      <Text style={[typeScale.titleLarge, { color: colors.text }]}>Estados</Text>
      <AppCard>
        <LoadingState title="Carregando exemplo" />
      </AppCard>
      <AppCard>
        <EmptyState title="Estado vazio" />
      </AppCard>
      <AppCard>
        <ErrorState title="Estado de erro" />
      </AppCard>

      <BottomSheet
        onDismiss={() => setSheetVisible(false)}
        title="Filtros de recarga"
        visible={sheetVisible}
      >
        <View style={styles.sheetContent}>
          <Text style={[typeScale.bodyLarge, { color: colors.text }]}>
            Conteúdo responsivo com área segura e acessibilidade modal.
          </Text>
          <PrimaryButton
            label="Aplicar filtros"
            onPress={() => setSheetVisible(false)}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' },
  surface: { padding: 16 },
  skeletons: { gap: 10 },
  sheetContent: { gap: 16, paddingVertical: 16 },
});
