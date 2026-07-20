import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { api } from '@/api';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { FilterChip } from '@/components/FilterChip';
import { StationMapMarker } from '@/components/StationMapMarker';
import { StationPreviewCard } from '@/components/StationPreviewCard';
import { messages } from '@/i18n/pt-BR';
import { useMapStore } from '@/stores/map-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import { countActiveFilters } from '@/utils/station-filters';

const initialRegion: Region = {
  latitude: -23.5565,
  longitude: -46.644,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function StationsScreen() {
  const { colors, radii } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const { filters, selectedStationId, setSelectedStationId } = useMapStore();
  const [locationGranted, setLocationGranted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const stationsQuery = useQuery({
    queryKey: ['stations', filters],
    queryFn: () => api.stations.getNearby(filters),
  });
  const stations = useMemo(() => stationsQuery.data ?? [], [stationsQuery.data]);
  const filteredStations = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    if (!query) return stations;
    return stations.filter((station) =>
      (station.name + ' ' + station.address)
        .toLocaleLowerCase('pt-BR')
        .includes(query),
    );
  }, [searchQuery, stations]);
  const selectedStation = useMemo(
    () => filteredStations.find((station) => station.id === selectedStationId) ?? filteredStations[0],
    [filteredStations, selectedStationId],
  );


  async function centerOnUser() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setLocationGranted(false);
      return;
    }
    setLocationGranted(true);
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    mapRef.current?.animateToRegion(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      450,
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.search,
            { borderColor: colors.border, borderRadius: radii.md },
          ]}
        >
          <Ionicons name="search" color={colors.textMuted} size={20} />
          <TextInput
            accessibilityLabel="Pesquisar destino"
            onChangeText={setSearchQuery}
            returnKeyType="search"
            value={searchQuery}
            placeholder={messages.stations.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        <Pressable
          accessibilityLabel="Abrir filtros"
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/stations/filters')}
          style={[
            styles.filterButton,
            { borderColor: colors.border, borderRadius: radii.md },
          ]}
        >
          <Ionicons name="options-outline" color={colors.text} size={22} />
          {countActiveFilters(filters) > 0 ? (
            <View style={[styles.filterCount, { backgroundColor: colors.primary }]}>
              <Text style={[styles.filterCountText, { color: colors.onPrimary }]}>
                {countActiveFilters(filters)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickFilters}
      >
        <FilterChip
          label={messages.stations.planRoute}
          onPress={() => router.push('/(tabs)/trips/plan')}
        />
        <FilterChip label={messages.stations.nearMe} onPress={() => void centerOnUser()} />
        <FilterChip
          label={messages.stations.fastCharge}
          selected={filters.minimumPowerKw >= 100}
          onPress={() =>
            useMapStore.getState().setFilters({
              ...filters,
              minimumPowerKw: filters.minimumPowerKw >= 100 ? 0 : 100,
            })
          }
        />
      </ScrollView>

      {stationsQuery.isLoading ? (
        <LoadingState title="Localizando estações próximas" />
      ) : stationsQuery.isError ? (
        <ErrorState
          title={messages.stations.error}
          message="Confira sua conexão e tente novamente."
          actionLabel={messages.common.retry}
          onAction={() => void stationsQuery.refetch()}
        />
      ) : (
        <View style={styles.mapArea}>
          <MapView
            ref={mapRef}
            initialRegion={initialRegion}
            showsUserLocation={locationGranted}
            style={StyleSheet.absoluteFill}
          >
            {filteredStations.map((station) => (
              <Marker
                key={station.id}
                coordinate={{
                  latitude: station.latitude,
                  longitude: station.longitude,
                }}
                description={station.address}
                onPress={() => setSelectedStationId(station.id)}
                title={station.name}
              >
                <StationMapMarker
                  selected={station.id === selectedStation?.id}
                  status={station.status}
                />
              </Marker>
            ))}
          </MapView>
          <Pressable
            accessibilityLabel="Centralizar na minha localização"
            accessibilityRole="button"
            onPress={() => void centerOnUser()}
            style={[
              styles.locationButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="locate" color={colors.primary} size={24} />
          </Pressable>
          {selectedStation ? (
            <View style={styles.preview}>
              <StationPreviewCard
                station={selectedStation}
                onDetails={() =>
                  router.push({
                    pathname: '/(tabs)/stations/[stationId]',
                    params: { stationId: selectedStation.id },
                  })
                }
                onReserve={() =>
                  router.push({
                    pathname: '/station/[stationId]/reserve',
                    params: { stationId: selectedStation.id },
                  })
                }
                onRoute={() =>
                  router.push({
                    pathname: '/(tabs)/trips/plan',
                    params: { destination: selectedStation.address },
                  })
                }
              />
            </View>
          ) : null}
        </View>
      )}
    </View>
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
  search: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  filterButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { fontSize: 11, fontWeight: '900' },
  quickFilters: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
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
  preview: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
});
