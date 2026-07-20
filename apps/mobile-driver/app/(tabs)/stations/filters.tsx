import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { FilterChip } from '@/components/FilterChip';
import { Screen } from '@/components/Screen';
import { useMapStore } from '@/stores/map-store';
import { useAppTheme } from '@/theme/ThemeProvider';
import type {
  CurrentType,
  PlugType,
  StationFilters,
  StationStatus,
} from '@/types/domain';
import { countActiveFilters, defaultStationFilters } from '@/utils/station-filters';

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function StationFiltersScreen() {
  const { colors } = useAppTheme();
  const storedFilters = useMapStore((state) => state.filters);
  const setFilters = useMapStore((state) => state.setFilters);
  const [draft, setDraft] = useState<StationFilters>(storedFilters);

  function toggleOperator() {
    const next = { ...draft };
    if (next.operator) {
      delete next.operator;
    } else {
      next.operator = 'Rede Solis';
    }
    setDraft(next);
  }

  return (
    <Screen>
      <AppHeader
        canGoBack
        title="Filtros"
        subtitle={String(countActiveFilters(draft)) + ' filtros ativos'}
      />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Disponibilidade</Text>
      <View style={styles.chips}>
        {(
          [
            ['AVAILABLE', 'Disponível'],
            ['PARTIAL', 'Parcial'],
            ['RESERVED', 'Reservada'],
          ] as const
        ).map(([value, label]) => (
          <FilterChip
            key={value}
            label={label}
            selected={draft.availability.includes(value as StationStatus)}
            onPress={() =>
              setDraft({
                ...draft,
                availability: toggleValue(draft.availability, value),
              })
            }
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Distância máxima</Text>
      <View style={styles.chips}>
        {[5, 10, 25, 50].map((distance) => (
          <FilterChip
            key={distance}
            label={String(distance) + ' km'}
            selected={draft.maximumDistanceKm === distance}
            onPress={() => setDraft({ ...draft, maximumDistanceKm: distance })}
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Conector</Text>
      <View style={styles.chips}>
        {(['CCS2', 'TYPE_2', 'CHADEMO'] as PlugType[]).map((plugType) => (
          <FilterChip
            key={plugType}
            label={plugType.replace('_', ' ')}
            selected={draft.plugTypes.includes(plugType)}
            onPress={() =>
              setDraft({
                ...draft,
                plugTypes: toggleValue(draft.plugTypes, plugType),
              })
            }
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Potência mínima</Text>
      <View style={styles.chips}>
        {[0, 22, 60, 100, 150].map((power) => (
          <FilterChip
            key={power}
            label={power === 0 ? 'Qualquer' : String(power) + ' kW'}
            selected={draft.minimumPowerKw === power}
            onPress={() => setDraft({ ...draft, minimumPowerKw: power })}
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Tipo de corrente</Text>
      <View style={styles.chips}>
        {(['AC', 'DC'] as CurrentType[]).map((currentType) => (
          <FilterChip
            key={currentType}
            label={currentType === 'AC' ? 'Alternada (AC)' : 'Contínua (DC)'}
            selected={draft.currentTypes.includes(currentType)}
            onPress={() =>
              setDraft({
                ...draft,
                currentTypes: toggleValue(draft.currentTypes, currentType),
              })
            }
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Preço máximo</Text>
      <View style={styles.chips}>
        {[1.9, 2.2, 2.5, 5].map((price) => (
          <FilterChip
            key={price}
            label={price === 5 ? 'Qualquer' : 'R$ ' + price.toFixed(2)}
            selected={draft.maximumPricePerKwh === price}
            onPress={() => setDraft({ ...draft, maximumPricePerKwh: price })}
          />
        ))}
      </View>

      <ToggleRow
        label="Somente estações 24 horas"
        value={draft.open24HoursOnly}
        onValueChange={(open24HoursOnly) => setDraft({ ...draft, open24HoursOnly })}
      />
      <ToggleRow
        label="Estacionamento disponível"
        value={draft.parkingOnly}
        onValueChange={(parkingOnly) => setDraft({ ...draft, parkingOnly })}
      />
      <ToggleRow
        label="Somente Rede Solis"
        value={draft.operator === 'Rede Solis'}
        onValueChange={toggleOperator}
      />

      <View style={styles.actions}>
        <View style={styles.action}>
          <AppButton
            label="Limpar filtros"
            variant="outline"
            onPress={() => setDraft(defaultStationFilters)}
          />
        </View>
        <View style={styles.action}>
          <AppButton
            label="Aplicar filtros"
            onPress={() => {
              setFilters(draft);
              router.back();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: 18, marginBottom: 10, fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  action: { flex: 1 },
});
