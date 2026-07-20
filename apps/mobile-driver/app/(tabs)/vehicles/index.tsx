import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { VehicleCard } from '@/components/VehicleCard';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function VehiclesScreen() {
  const { colors } = useAppTheme();
  const query = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.vehicles.list(),
  });

  if (query.isLoading) {
    return <Screen><LoadingState title="Carregando veículos" /></Screen>;
  }
  if (query.isError) {
    return (
      <Screen>
        <ErrorState
          title="Não foi possível carregar seus veículos"
          actionLabel="Tentar novamente"
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Seus veículos"
        subtitle="Compatibilidade e autonomia para cada trajeto."
      />
      <AppCard>
        <View style={styles.homeHeader}>
          <View style={[styles.homeIcon, { backgroundColor: colors.elevatedSurface }]}>
            <Ionicons name="home-outline" size={25} color={colors.secondary} />
          </View>
          <View style={styles.homeCopy}>
            <Text style={[styles.homeTitle, { color: colors.text }]}>
              Possui carregador residencial?
            </Text>
            <Text style={[styles.homeBody, { color: colors.textMuted }]}>
              Cadastro, horários e compartilhamento chegam em breve.
            </Text>
          </View>
        </View>
        <AppButton
          label="Conhecer recurso"
          variant="outline"
          onPress={() => Alert.alert('Em breve', 'O módulo residencial não bloqueia o MVP.')}
        />
      </AppCard>

      {query.data?.length ? (
        query.data.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/vehicles/[vehicleId]',
                params: { vehicleId: vehicle.id },
              })
            }
          />
        ))
      ) : (
        <EmptyState
          title="Nenhum veículo cadastrado"
          message="Adicione um veículo para receber rotas e estações compatíveis."
        />
      )}
      <AppButton
        label="Adicionar veículo"
        onPress={() => router.push('/(tabs)/vehicles/new')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  homeHeader: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  homeIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeCopy: { flex: 1 },
  homeTitle: { fontSize: 16, fontWeight: '800' },
  homeBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
});
