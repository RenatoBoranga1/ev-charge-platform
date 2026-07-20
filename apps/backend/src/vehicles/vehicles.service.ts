import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

export interface VehicleDto {
  averageConsumptionKwhPer100Km?: number;
  batteryCapacityKwh: number;
  brand: string;
  createdAt: string;
  estimatedRangeKm?: number;
  id: string;
  isDefault: boolean;
  licensePlate?: string;
  model: string;
  supportedPlugTypes: string[];
  updatedAt: string;
  userId: string;
  vehicleType: string;
  version?: string;
  year?: number;
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<VehicleDto[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return vehicles.map((vehicle) => ({
      ...(vehicle.averageConsumptionKwhPer100Km
        ? {
            averageConsumptionKwhPer100Km: Number(
              vehicle.averageConsumptionKwhPer100Km,
            ),
          }
        : {}),
      batteryCapacityKwh: Number(vehicle.batteryCapacityKwh),
      brand: vehicle.brand,
      createdAt: vehicle.createdAt.toISOString(),
      ...(vehicle.estimatedRangeKm
        ? { estimatedRangeKm: vehicle.estimatedRangeKm }
        : {}),
      id: vehicle.id,
      isDefault: vehicle.isDefault,
      ...(vehicle.licensePlate ? { licensePlate: vehicle.licensePlate } : {}),
      model: vehicle.model,
      supportedPlugTypes: vehicle.supportedPlugTypes,
      updatedAt: vehicle.updatedAt.toISOString(),
      userId: vehicle.userId,
      vehicleType: vehicle.vehicleType,
      ...(vehicle.trim ? { version: vehicle.trim } : {}),
      ...(vehicle.year ? { year: vehicle.year } : {}),
    }));
  }
}
