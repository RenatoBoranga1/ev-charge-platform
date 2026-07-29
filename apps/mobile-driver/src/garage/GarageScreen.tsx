import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppHeader } from '@/components/AppHeader';
import { AppCard } from '@/components/AppCard';
import { ErrorState } from '@/components/AsyncState';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { VehicleList } from '@/components/VehicleList';
import { VehicleSkeleton } from '@/components/VehicleSkeleton';
import { BottomSheet, FAB, SearchBar } from '@/design-system';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { VehicleListFilters, VehicleStatus, VehicleType } from '@/types/domain';

const sortOptions: {
  label: string;
  sortBy: NonNullable<VehicleListFilters['sortBy']>;
  sortOrder: NonNullable<VehicleListFilters['sortOrder']>;
}[] = [
  { label: 'Mais recentes', sortBy: 'createdAt', sortOrder: 'desc' },
  { label: 'Apelido (A–Z)', sortBy: 'nickname', sortOrder: 'asc' },
  { label: 'Marca (A–Z)', sortBy: 'brand', sortOrder: 'asc' },
  { label: 'Ano mais novo', sortBy: 'year', sortOrder: 'desc' },
];

export function GarageScreen() {
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<VehicleType | undefined>();
  const [status, setStatus] = useState<VehicleStatus | undefined>('ACTIVE');
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [sort, setSort] = useState(sortOptions[0]!);
  const debouncedSearch = useDebouncedValue(search);

  const filters = useMemo<VehicleListFilters>(
    () => ({
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    }),
    [debouncedSearch, sort, status, type],
  );
  const query = useQuery({
    queryKey: ['vehicles', filters],
    queryFn: () => api.vehicles.list(filters),
  });
  const openVehicle = useCallback((vehicleId: string) => {
    router.push({
      pathname: '/(tabs)/vehicles/[vehicleId]',
      params: { vehicleId },
    });
  }, []);
  const addVehicle = useCallback(() => {
    router.push('/(tabs)/vehicles/new');
  }, []);
  const clearFilters = useCallback(() => {
    setSearch('');
    setType(undefined);
    setStatus(undefined);
  }, []);
  const isFiltered = Boolean(search || type || status);

  return (
    <Screen scroll={false}>
      <AppHeader title="Minha Garagem" subtitle="Seus veículos, compatibilidade e autonomia." />
      {query.data ? (
        <AppCard
          accessibilityLabel={`${query.data.length} veículos nesta visualização da garagem`}
          style={styles.summary}
        >
          <View style={[styles.summaryIcon, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="car-sport-outline" color={colors.primary} size={26} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {query.data.length} {query.data.length === 1 ? 'veículo' : 'veículos'}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
              Compatibilidade, autonomia e veículo principal em um só lugar.
            </Text>
          </View>
        </AppCard>
      ) : null}

      <SearchBar
        onChangeText={setSearch}
        placeholder="Buscar por apelido, marca, modelo ou placa"
        value={search}
      />
      <View style={styles.filterBar}>
        <FilterChip label="Todos" selected={!type && !status} onPress={clearFilters} />
        <FilterChip
          label="Elétricos"
          selected={type === 'BEV'}
          onPress={() => setType(type === 'BEV' ? undefined : 'BEV')}
        />
        <FilterChip
          label="Plug-in"
          selected={type === 'PHEV'}
          onPress={() => setType(type === 'PHEV' ? undefined : 'PHEV')}
        />
        <FilterChip
          label="Ativos"
          selected={status === 'ACTIVE'}
          onPress={() => setStatus(status === 'ACTIVE' ? undefined : 'ACTIVE')}
        />
        <Pressable
          accessibilityHint="Abre as opções de ordenação"
          accessibilityLabel={`Ordenar veículos: ${sort.label}`}
          accessibilityRole="button"
          onPress={() => setSortSheetVisible(true)}
          style={[styles.sortButton, { borderColor: colors.border }]}
        >
          <Ionicons name="swap-vertical" color={colors.primary} size={20} />
          <Text style={[styles.sortLabel, { color: colors.primary }]}>Ordenar</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {query.isLoading ? <VehicleSkeleton /> : null}
        {query.isError ? (
          <ErrorState
            actionLabel="Tentar novamente"
            message={query.error.message}
            onAction={() => void query.refetch()}
            title="Não foi possível carregar sua garagem"
          />
        ) : null}
        {query.data ? (
          <VehicleList
            emptyFiltered={isFiltered}
            onAdd={isFiltered ? clearFilters : addVehicle}
            onPress={openVehicle}
            vehicles={query.data}
          />
        ) : null}
      </View>

      <View style={styles.fab}>
        <FAB
          accessibilityLabel="Adicionar veículo"
          extendedLabel="Adicionar"
          icon="add"
          onPress={addVehicle}
        />
      </View>
      <BottomSheet
        onDismiss={() => setSortSheetVisible(false)}
        title="Ordenar veículos"
        visible={sortSheetVisible}
      >
        <View style={styles.sortOptions}>
          {sortOptions.map((option) => (
            <FilterChip
              key={`${option.sortBy}-${option.sortOrder}`}
              label={option.label}
              selected={sort.sortBy === option.sortBy && sort.sortOrder === option.sortOrder}
              onPress={() => {
                setSort(option);
                setSortSheetVisible(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortButton: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 21,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: { fontSize: 13, fontWeight: '800' },
  list: { flex: 1 },
  fab: { position: 'absolute', right: 20, bottom: 20 },
  sortOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 12 },
  summary: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  summaryCopy: { flex: 1, gap: 3 },
  summaryIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  summaryLabel: { fontSize: 12, lineHeight: 17 },
  summaryValue: { fontSize: 19, fontWeight: '900' },
});
