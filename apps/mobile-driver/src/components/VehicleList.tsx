import { useCallback } from 'react';
import { FlatList, StyleSheet, type ListRenderItem } from 'react-native';

import { VehicleCard } from './VehicleCard';
import { VehicleEmptyState } from './VehicleEmptyState';
import type { Vehicle } from '@/types/domain';

interface VehicleListProps {
  emptyFiltered?: boolean;
  onAdd: () => void;
  onPress: (vehicleId: string) => void;
  vehicles: Vehicle[];
}

export function VehicleList({
  emptyFiltered = false,
  onAdd,
  onPress,
  vehicles,
}: VehicleListProps) {
  const renderItem = useCallback<ListRenderItem<Vehicle>>(
    ({ item }) => (
      <VehicleCard vehicle={item} onPress={() => onPress(item.id)} />
    ),
    [onPress],
  );

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        vehicles.length === 0 ? styles.empty : undefined,
      ]}
      data={vehicles}
      initialNumToRender={8}
      keyExtractor={(vehicle) => vehicle.id}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <VehicleEmptyState
          filtered={emptyFiltered}
          onAdd={onAdd}
        />
      }
      maxToRenderPerBatch={8}
      renderItem={renderItem}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 104 },
  empty: { flexGrow: 1 },
});
