import type { Vehicle } from '@solis/database';

export interface VehicleDto {
  averageConsumptionKwhPer100Km?: number;
  batteryCapacityKwh: number;
  brand: string;
  color?: string;
  createdAt: string;
  estimatedRangeKm?: number;
  id: string;
  imageUrl?: string;
  isDefault: boolean;
  licensePlate?: string;
  maximumAcPowerKw?: number;
  maximumDcPowerKw?: number;
  model: string;
  nickname: string;
  notes?: string;
  recordVersion: number;
  status: string;
  supportedPlugTypes: string[];
  updatedAt: string;
  userId: string;
  vehicleType: string;
  version?: string;
  vin?: string;
  year?: number;
}

export function toVehicleDto(vehicle: Vehicle): VehicleDto {
  return {
    ...(vehicle.averageConsumptionKwhPer100Km
      ? {
          averageConsumptionKwhPer100Km: Number(
            vehicle.averageConsumptionKwhPer100Km,
          ),
        }
      : {}),
    batteryCapacityKwh: Number(vehicle.batteryCapacityKwh),
    brand: vehicle.brand,
    ...(vehicle.color ? { color: vehicle.color } : {}),
    createdAt: vehicle.createdAt.toISOString(),
    ...(vehicle.estimatedRangeKm !== null
      ? { estimatedRangeKm: vehicle.estimatedRangeKm }
      : {}),
    id: vehicle.id,
    ...(vehicle.imageUrl ? { imageUrl: vehicle.imageUrl } : {}),
    isDefault: vehicle.isDefault,
    ...(vehicle.licensePlate
      ? { licensePlate: vehicle.licensePlate }
      : {}),
    ...(vehicle.maximumAcPowerKw
      ? { maximumAcPowerKw: Number(vehicle.maximumAcPowerKw) }
      : {}),
    ...(vehicle.maximumDcPowerKw
      ? { maximumDcPowerKw: Number(vehicle.maximumDcPowerKw) }
      : {}),
    model: vehicle.model,
    nickname: vehicle.nickname,
    ...(vehicle.notes ? { notes: vehicle.notes } : {}),
    recordVersion: vehicle.version,
    status: vehicle.status,
    supportedPlugTypes: vehicle.supportedPlugTypes,
    updatedAt: vehicle.updatedAt.toISOString(),
    userId: vehicle.userId,
    vehicleType: vehicle.vehicleType,
    ...(vehicle.trim ? { version: vehicle.trim } : {}),
    ...(vehicle.vin ? { vin: vehicle.vin } : {}),
    ...(vehicle.year !== null ? { year: vehicle.year } : {}),
  };
}
