import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from './AppCard';
import { ConnectorBadge } from './ConnectorBadge';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Vehicle } from '@/types/domain';

interface VehicleCardProps {
  vehicle: Vehicle;
  selected?: boolean;
  onPress: () => void;
}

export function VehicleCard({
  vehicle,
  selected = false,
  onPress,
}: VehicleCardProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <AppCard
        style={{
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        }}
      >
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: colors.elevatedSurface }]}>
            <Ionicons name="car-sport-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.brand, { color: colors.text }]}>
              {vehicle.brand}
            </Text>
            <Text style={[styles.model, { color: colors.text }]}>
              {vehicle.model}
            </Text>
          </View>
          {vehicle.isDefault ? (
            <Text style={[styles.defaultLabel, { color: colors.primary }]}>
              Principal
            </Text>
          ) : null}
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {vehicle.vehicleType === 'BEV' ? 'Elétrico' : 'Híbrido plug-in'} ·{' '}
          {vehicle.batteryCapacityKwh} kWh
          {vehicle.estimatedRangeKm ? ` · ${vehicle.estimatedRangeKm} km` : ''}
        </Text>
        <View style={styles.badges}>
          {vehicle.supportedPlugTypes.map((plugType) => (
            <ConnectorBadge key={plugType} plugType={plugType} />
          ))}
        </View>
        {vehicle.licensePlate ? (
          <Text style={[styles.plate, { color: colors.textMuted }]}>
            Placa {vehicle.licensePlate}
          </Text>
        ) : null}
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  brand: { fontSize: 13, fontWeight: '700' },
  model: { fontSize: 19, fontWeight: '800', marginTop: 2 },
  defaultLabel: { fontSize: 12, fontWeight: '800' },
  meta: { marginTop: 14, fontSize: 14 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 12 },
  plate: { marginTop: 12, fontSize: 13 },
});
