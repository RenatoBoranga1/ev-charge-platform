import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppCard } from './AppCard';
import { ConnectorBadge } from './ConnectorBadge';
import {
  maskLicensePlate,
  vehicleStatusLabel,
  vehicleTypeLabel,
} from '@/garage/vehicle-catalog';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { Vehicle } from '@/types/domain';

interface VehicleDetailsProps {
  vehicle: Vehicle;
}

export function VehicleDetails({ vehicle }: VehicleDetailsProps) {
  const { colors } = useAppTheme();
  const rows: [string, string][] = [
    ['Tipo', vehicleTypeLabel(vehicle.vehicleType)],
    ['Status', vehicleStatusLabel(vehicle.status)],
    ['Ano', vehicle.year ? String(vehicle.year) : 'Não informado'],
    ['Versão', vehicle.version ?? 'Não informada'],
    ['Cor', vehicle.color ?? 'Não informada'],
    ['Placa', maskLicensePlate(vehicle.licensePlate) ?? 'Não informada'],
    ['VIN', vehicle.vin ? `${vehicle.vin.slice(0, 3)}••••••••••${vehicle.vin.slice(-3)}` : 'Não informado'],
    ['Bateria', `${vehicle.batteryCapacityKwh} kWh`],
    ['Autonomia', vehicle.estimatedRangeKm ? `${vehicle.estimatedRangeKm} km` : 'Não informada'],
    ['Potência AC', vehicle.maximumAcPowerKw ? `${vehicle.maximumAcPowerKw} kW` : 'Não informada'],
    ['Potência DC', vehicle.maximumDcPowerKw ? `${vehicle.maximumDcPowerKw} kW` : 'Não informada'],
  ];

  return (
    <>
      <View style={[styles.hero, { backgroundColor: colors.elevatedSurface }]}>
        {vehicle.imageUrl ? (
          <Image
            accessibilityLabel={`Foto de ${vehicle.nickname}`}
            source={{ uri: vehicle.imageUrl }}
            style={styles.image}
          />
        ) : (
          <Ionicons name="car-sport-outline" color={colors.primary} size={72} />
        )}
      </View>
      <AppCard>
        {rows.map(([label, value]) => (
          <View
            key={label}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Conectores</Text>
        <View style={styles.plugs}>
          {vehicle.supportedPlugTypes.length ? (
            vehicle.supportedPlugTypes.map((plug) => (
              <ConnectorBadge key={plug} plugType={plug} />
            ))
          ) : (
            <Text style={{ color: colors.textMuted }}>Não utiliza recarga externa</Text>
          )}
        </View>
        {vehicle.notes ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Observações</Text>
            <Text style={[styles.notes, { color: colors.textMuted }]}>{vehicle.notes}</Text>
          </>
        ) : null}
      </AppCard>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Estatísticas e sessões
        </Text>
        <Text style={[styles.notes, { color: colors.textMuted }]}>
          Consumo, custos e sessões deste veículo serão apresentados em uma fase futura.
        </Text>
      </AppCard>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 190,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  row: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: { flex: 1, fontSize: 14 },
  value: { flex: 1.4, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  plugs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 12 },
  notes: { fontSize: 14, lineHeight: 21 },
});
