import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from './AppCard';
import { ConnectorBadge } from './ConnectorBadge';
import {
  maskLicensePlate,
  vehicleStatusLabel,
  vehicleTypeLabel,
} from '@/garage/vehicle-catalog';
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
  const plate = maskLicensePlate(vehicle.licensePlate);

  return (
    <Pressable
      accessibilityHint="Abre os detalhes do veículo"
      accessibilityLabel={`${vehicle.nickname}, ${vehicle.brand} ${vehicle.model}, ${vehicleStatusLabel(vehicle.status)}${vehicle.isDefault ? ', veículo principal' : ''}`}
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
          <View style={[styles.image, { backgroundColor: colors.elevatedSurface }]}>
            {vehicle.imageUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: vehicle.imageUrl }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Ionicons name="car-sport-outline" size={28} color={colors.primary} />
            )}
          </View>
          <View style={styles.copy}>
            <Text style={[styles.nickname, { color: colors.text }]}>
              {vehicle.nickname}
            </Text>
            <Text style={[styles.model, { color: colors.textMuted }]}>
              {vehicle.brand} {vehicle.model}
            </Text>
          </View>
          {vehicle.isDefault ? (
            <View style={[styles.defaultBadge, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.defaultLabel, { color: colors.onPrimaryContainer }]}>
                Principal
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {vehicleTypeLabel(vehicle.vehicleType)} · {vehicle.batteryCapacityKwh} kWh
          {vehicle.estimatedRangeKm ? ` · ${vehicle.estimatedRangeKm} km` : ''}
          {' · '}{vehicleStatusLabel(vehicle.status)}
        </Text>
        <View style={styles.badges}>
          {vehicle.supportedPlugTypes.map((plugType) => (
            <ConnectorBadge key={plugType} plugType={plugType} />
          ))}
        </View>
        {plate ? (
          <Text style={[styles.plate, { color: colors.textMuted }]}>
            Placa {plate}
          </Text>
        ) : null}
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  image: {
    width: 54,
    height: 54,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  nickname: { fontSize: 18, fontWeight: '900' },
  model: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  defaultBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  defaultLabel: { fontSize: 11, fontWeight: '900' },
  meta: { marginTop: 14, fontSize: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  plate: { marginTop: 12, fontSize: 13 },
});
