import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '@/components/AsyncState';
import {
  StationClusterMarker,
  StationMapMarker,
} from '@/components/StationMapMarker';
import { StationPreviewCard } from '@/components/StationPreviewCard';
import {
  Badge,
  BottomSheet,
  Chip,
  OutlinedButton,
  SearchBar,
  useFeedback,
} from '@/design-system';
import {
  getCurrentMapAvailability,
  getMapRuntimeConfig,
} from '@/config/maps';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUserLocation } from '@/location';
import { openExternalRoute } from '@/navigation/external-maps';
import { clusterPoints } from '@/stations/clustering';
import {
  discoverStations,
  type StationSortMode,
} from '@/stations/discovery';
import { useMapStore } from '@/stores/map-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Station } from '@/types/domain';
import { countActiveFilters } from '@/utils/station-filters';

const sortOptions: readonly {
  label: string;
  value: StationSortMode;
}[] = [
  { value: 'distance', label: 'Mais próximas' },
  { value: 'availability', label: 'Mais disponíveis' },
  { value: 'power', label: 'Maior potência' },
  { value: 'price', label: 'Menor preço' },
  { value: 'name', label: 'Nome' },
];

const mapConfig = getMapRuntimeConfig();

export default function StationsScreen() {
  const { colors, radii, shadows, typeScale } = useAppTheme();
  const feedback = useFeedback();
  const mapRef = useRef<MapView>(null);
  const network = useNetworkState();
  const location = useUserLocation();
  const {
    filters,
    searchQuery,
    selectedStationId,
    sortMode,
    viewMode,
    setFilters,
    setSearchQuery,
    setSelectedStationId,
    setSortMode,
    setViewMode,
  } = useMapStore();
  const [sortVisible, setSortVisible] = useState(false);
  const [region, setRegion] = useState<Region>(mapConfig.fallbackRegion);
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const origin = location.coordinates ?? mapConfig.fallbackRegion;
  const mapAvailability = getCurrentMapAvailability(mapConfig);
  const isOffline =
    network.isConnected === false || network.isInternetReachable === false;

  const stationsQuery = useQuery({
    queryKey: [
      'stations',
      'nearby',
      filters,
      origin.latitude,
      origin.longitude,
    ],
    queryFn: ({ signal }) =>
      api.stations.getNearby(filters, {
        latitude: origin.latitude,
        longitude: origin.longitude,
        signal,
      }),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const stations = useMemo(
    () =>
      discoverStations(stationsQuery.data ?? [], {
        filters,
        origin,
        searchQuery: debouncedSearch,
        sortMode,
      }),
    [debouncedSearch, filters, origin, sortMode, stationsQuery.data],
  );
  const selectedStation = useMemo(
    () =>
      stations.find((station) => station.id === selectedStationId) ?? null,
    [selectedStationId, stations],
  );
  const clusters = useMemo(
    () =>
      clusterPoints(
        stations.map((station) => ({
          id: station.id,
          latitude: station.latitude,
          longitude: station.longitude,
          value: station,
        })),
        region,
      ),
    [region, stations],
  );
  const activeFilters = countActiveFilters(filters);

  const openDetails = useCallback((station: Station) => {
    router.push({
      pathname: '/(tabs)/stations/[stationId]',
      params: { stationId: station.id },
    });
  }, []);

  const reserve = useCallback((station: Station) => {
    router.push({
      pathname: '/station/[stationId]/reserve',
      params: { stationId: station.id },
    });
  }, []);

  const traceRoute = useCallback(
    async (station: Station) => {
      const result = await openExternalRoute({
        address: station.address,
        label: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
      });
      if (!result.ok && result.code !== 'cancelled') {
        feedback.showToast(
          'Não foi possível abrir um aplicativo de navegação.',
          { tone: 'danger' },
        );
      }
    },
    [feedback],
  );

  const centerOnUser = useCallback(async () => {
    const result =
      location.permission.status === 'granted'
        ? await location.refresh()
        : await location.requestPermission();
    if (!result) return;
    if (!result.ok) {
      feedback.showToast(result.error.message, { tone: 'warning' });
      return;
    }
    const nextRegion: Region = {
      latitude: result.coordinates.latitude,
      longitude: result.coordinates.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 450);
  }, [feedback, location]);

  const openLocationSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      feedback.showToast('Não foi possível abrir as configurações.', {
        tone: 'danger',
      });
    }
  }, [feedback]);

  const refresh = useCallback(async () => {
    const result = await stationsQuery.refetch();
    feedback.showToast(
      result.isError
        ? 'Não foi possível atualizar as estações.'
        : 'Estações atualizadas.',
      { tone: result.isError ? 'danger' : 'success' },
    );
  }, [feedback, stationsQuery]);

  const selectStation = useCallback(
    (station: Station) => {
      setSelectedStationId(station.id);
      if (viewMode === 'map') {
        mapRef.current?.animateCamera(
          {
            center: {
              latitude: station.latitude,
              longitude: station.longitude,
            },
          },
          { duration: 300 },
        );
      }
    },
    [setSelectedStationId, viewMode],
  );

  const renderStation = useCallback(
    ({ item }: { item: Station }) => (
      <View style={styles.listCard}>
        <StationPreviewCard
          station={item}
          onDetails={() => openDetails(item)}
          onReserve={() => reserve(item)}
          onRoute={() => void traceRoute(item)}
          onSelect={() => selectStation(item)}
        />
      </View>
    ),
    [openDetails, reserve, selectStation, traceRoute],
  );

  const emptyContent = (
    <EmptyState
      title="Nenhuma estação encontrada"
      message="Altere a pesquisa ou os filtros para ampliar os resultados."
      actionLabel="Limpar busca e filtros"
      onAction={() => {
        setSearchQuery('');
        useMapStore.getState().clearFilters();
      }}
    />
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={[styles.toolbar, { backgroundColor: colors.surface }]}>
        <View style={styles.search}>
          <SearchBar
            onChangeText={setSearchQuery}
            placeholder="Pesquisar endereço, estação ou operador"
            value={searchQuery}
          />
        </View>
        <Pressable
          accessibilityLabel={`Abrir filtros. ${activeFilters} ativos.`}
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => router.push('/(tabs)/stations/filters')}
          style={[
            styles.iconButton,
            { borderColor: colors.outlineVariant, borderRadius: radii.pill },
          ]}
        >
          <Ionicons name="options-outline" color={colors.text} size={22} />
          {activeFilters > 0 ? (
            <View style={styles.badge}>
              <Badge label={String(activeFilters)} tone="primary" />
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFiltersScroll}
        contentContainerStyle={styles.quickFilters}
      >
        <Chip
          icon="navigate-outline"
          label="Planejar viagem"
          onPress={() => router.push('/(tabs)/trips/plan')}
        />
        <Chip
          icon="locate-outline"
          label="Perto de mim"
          onPress={() => void centerOnUser()}
          selected={location.permission.status === 'granted'}
        />
        <Chip
          icon="flash-outline"
          label="Carga rápida"
          selected={filters.minimumPowerKw >= 100}
          onPress={() =>
            setFilters({
              ...filters,
              minimumPowerKw: filters.minimumPowerKw >= 100 ? 0 : 100,
            })
          }
        />
        <Chip
          icon="swap-vertical-outline"
          label={
            sortOptions.find((option) => option.value === sortMode)?.label ??
            'Ordenar'
          }
          onPress={() => setSortVisible(true)}
        />
      </ScrollView>

      <View style={styles.viewSwitch}>
        <Chip
          icon="map-outline"
          label="Mapa"
          onPress={() => setViewMode('map')}
          selected={viewMode === 'map'}
        />
        <Chip
          icon="list-outline"
          label="Lista"
          onPress={() => setViewMode('list')}
          selected={viewMode === 'list'}
        />
        <Pressable
          accessibilityLabel="Atualizar estações"
          accessibilityRole="button"
          disabled={stationsQuery.isFetching}
          hitSlop={8}
          onPress={() => void refresh()}
          style={styles.refreshButton}
        >
          <Ionicons
            name="refresh"
            color={colors.primary}
            size={22}
          />
        </Pressable>
        <Text style={[typeScale.labelMedium, { color: colors.textMuted }]}>
          {stations.length} resultado{stations.length === 1 ? '' : 's'}
        </Text>
      </View>

      {isOffline ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.banner, { backgroundColor: `${colors.warning}1F` }]}
        >
          <Ionicons name="cloud-offline-outline" color={colors.warning} size={20} />
          <Text
            style={[
              styles.bannerText,
              { color: colors.text },
            ]}
          >
            Sem internet. Exibindo os últimos dados disponíveis.
          </Text>
        </View>
      ) : null}
      {mapAvailability.warning && viewMode === 'map' ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.banner, { backgroundColor: `${colors.warning}1F` }]}
        >
          <Ionicons name="key-outline" color={colors.warning} size={20} />
          <Text
            style={[
              styles.bannerText,
              { color: colors.text },
            ]}
          >
            Chave nativa do mapa ausente. Permitido somente em desenvolvimento.
          </Text>
        </View>
      ) : null}
      {location.permission.status === 'granted' &&
      location.permission.precision === 'approximate' &&
      viewMode === 'map' ? (
        <View style={[styles.banner, { backgroundColor: colors.surfaceContainer }]}>
          <Ionicons name="navigate-outline" color={colors.primary} size={20} />
          <Text style={[styles.bannerText, { color: colors.text }]}>
            Localização aproximada em uso. Distâncias podem variar.
          </Text>
        </View>
      ) : null}
      {location.error &&
      viewMode === 'map' ? (
        <View style={[styles.banner, { backgroundColor: colors.surfaceContainer }]}>
          <Ionicons name="location-outline" color={colors.primary} size={20} />
          <Text style={[styles.bannerText, { color: colors.text }]}>
            {location.error.message}
          </Text>
          {location.permission.status === 'blocked' ? (
            <OutlinedButton
              label="Configurações"
              onPress={() => void openLocationSettings()}
            />
          ) : null}
        </View>
      ) : null}

      {stationsQuery.isLoading && !stationsQuery.data ? (
        <LoadingState title="Localizando estações próximas" />
      ) : stationsQuery.isError && !stationsQuery.data ? (
        isOffline ? (
          <ErrorState
            title="Você está offline"
            message="Conecte-se à internet para carregar as estações pela primeira vez."
            actionLabel="Tentar novamente"
            onAction={() => void refresh()}
          />
        ) : (
          <ErrorState
            title="Não foi possível carregar as estações"
            message="Confira sua conexão e tente novamente."
            actionLabel="Tentar novamente"
            onAction={() => void refresh()}
          />
        )
      ) : viewMode === 'list' ? (
        <FlatList
          contentContainerStyle={[
            styles.listContent,
            stations.length === 0 && styles.emptyList,
          ]}
          data={stations}
          initialNumToRender={6}
          keyExtractor={(station) => station.id}
          ListEmptyComponent={emptyContent}
          maxToRenderPerBatch={8}
          refreshControl={
            <RefreshControl
              onRefresh={() => void refresh()}
              refreshing={stationsQuery.isFetching}
              tintColor={colors.primary}
            />
          }
          removeClippedSubviews
          renderItem={renderStation}
          windowSize={7}
        />
      ) : !mapAvailability.available ? (
        <PermissionState
          title="Mapa não configurado"
          message="Configure a chave nativa do provedor para este ambiente. A lista de estações continua disponível."
          actionLabel="Abrir lista"
          onAction={() => setViewMode('list')}
        />
      ) : (
        <View style={styles.mapArea}>
          <MapView
            ref={mapRef}
            initialRegion={mapConfig.fallbackRegion}
            loadingEnabled
            onRegionChangeComplete={setRegion}
            provider={
              mapConfig.provider === 'google' ? PROVIDER_GOOGLE : undefined
            }
            showsMyLocationButton={false}
            showsUserLocation={location.permission.status === 'granted'}
            style={StyleSheet.absoluteFill}
          >
            {clusters.map((cluster) => {
              if (cluster.kind === 'cluster') {
                return (
                  <Marker
                    key={cluster.id}
                    accessibilityLabel={`Ampliar agrupamento de ${cluster.points.length} estações`}
                    coordinate={{
                      latitude: cluster.latitude,
                      longitude: cluster.longitude,
                    }}
                    onPress={() =>
                      mapRef.current?.fitToCoordinates(
                        cluster.points.map((point) => ({
                          latitude: point.latitude,
                          longitude: point.longitude,
                        })),
                        {
                          animated: true,
                          edgePadding: {
                            top: 80,
                            right: 80,
                            bottom: 240,
                            left: 80,
                          },
                        },
                      )
                    }
                  >
                    <StationClusterMarker count={cluster.points.length} />
                  </Marker>
                );
              }
              const station = cluster.point.value;
              return (
                <Marker
                  key={station.id}
                  accessibilityLabel={`${station.name}. ${station.availableConnectors} conectores disponíveis.`}
                  coordinate={{
                    latitude: station.latitude,
                    longitude: station.longitude,
                  }}
                  description={station.address}
                  onPress={() => setSelectedStationId(station.id)}
                  title={station.name}
                >
                  <StationMapMarker
                    availableConnectors={station.availableConnectors}
                    selected={station.id === selectedStation?.id}
                    status={station.status}
                    totalConnectors={station.totalConnectors}
                  />
                </Marker>
              );
            })}
          </MapView>
          <Pressable
            accessibilityLabel="Centralizar na minha localização"
            accessibilityRole="button"
            onPress={() => void centerOnUser()}
            style={[
              styles.locationButton,
              shadows.level2,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Ionicons name="locate" color={colors.primary} size={24} />
          </Pressable>
          {stations.length === 0 ? (
            <View
              style={[
                styles.mapEmpty,
                shadows.level2,
                { backgroundColor: colors.surface },
              ]}
            >
              {emptyContent}
            </View>
          ) : null}
          {selectedStation ? (
            <View style={styles.preview}>
              <StationPreviewCard
                station={selectedStation}
                onDetails={() => openDetails(selectedStation)}
                onReserve={() => reserve(selectedStation)}
                onRoute={() => void traceRoute(selectedStation)}
              />
            </View>
          ) : null}
        </View>
      )}

      <BottomSheet
        onDismiss={() => setSortVisible(false)}
        title="Ordenar estações"
        visible={sortVisible}
      >
        <View style={styles.sortOptions}>
          {sortOptions.map((option) => (
            <Chip
              key={option.value}
              icon={
                option.value === sortMode
                  ? 'checkmark-circle'
                  : 'ellipse-outline'
              }
              label={option.label}
              onPress={() => {
                setSortMode(option.value);
                setSortVisible(false);
              }}
              selected={option.value === sortMode}
            />
          ))}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  search: { flex: 1 },
  iconButton: {
    width: 52,
    height: 52,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -7, right: -7 },
  quickFiltersScroll: { flexGrow: 0, maxHeight: 62 },
  quickFilters: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  viewSwitch: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  mapArea: { flex: 1 },
  locationButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEmpty: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    maxHeight: 300,
    borderRadius: 20,
  },
  preview: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  listContent: { paddingVertical: 8, paddingBottom: 120 },
  emptyList: { flexGrow: 1 },
  listCard: { paddingHorizontal: 16, paddingVertical: 8 },
  sortOptions: {
    paddingVertical: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
