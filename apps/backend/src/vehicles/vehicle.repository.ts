import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Vehicle,
  type VehicleStatus,
  type VehicleType,
} from '@solis/database';

import { PrismaService } from '../database/prisma.service';
import type { VehicleSortField } from './dto/list-vehicles.dto';

export interface VehicleListOptions {
  search?: string;
  sortBy: VehicleSortField;
  sortOrder: 'asc' | 'desc';
  status?: VehicleStatus;
  type?: VehicleType;
}

export abstract class VehicleRepository {
  abstract findById(userId: string, vehicleId: string): Promise<Vehicle | null>;
  abstract findDuplicate(
    userId: string,
    licensePlate?: string,
    vin?: string,
    excludeId?: string,
  ): Promise<Vehicle | null>;
  abstract list(userId: string, options: VehicleListOptions): Promise<Vehicle[]>;
}

@Injectable()
export class PrismaVehicleRepository extends VehicleRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findById(userId: string, vehicleId: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({
      where: { deletedAt: null, id: vehicleId, userId },
    });
  }

  findDuplicate(
    userId: string,
    licensePlate?: string,
    vin?: string,
    excludeId?: string,
  ): Promise<Vehicle | null> {
    const matches: Prisma.VehicleWhereInput[] = [];
    if (licensePlate) {
      matches.push({
        licensePlate: { equals: licensePlate, mode: 'insensitive' },
      });
    }
    if (vin) {
      matches.push({ vin: { equals: vin, mode: 'insensitive' } });
    }
    if (matches.length === 0) return Promise.resolve(null);
    return this.prisma.vehicle.findFirst({
      where: {
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        userId,
        OR: matches,
      },
    });
  }

  list(userId: string, options: VehicleListOptions): Promise<Vehicle[]> {
    const search = options.search?.trim();
    const orderBy: Prisma.VehicleOrderByWithRelationInput =
      options.sortBy === 'nickname'
        ? { nickname: options.sortOrder }
        : options.sortBy === 'brand'
          ? { brand: options.sortOrder }
          : options.sortBy === 'year'
            ? { year: options.sortOrder }
            : { createdAt: options.sortOrder };

    return this.prisma.vehicle.findMany({
      orderBy: [{ isDefault: 'desc' }, orderBy],
      where: {
        deletedAt: null,
        status: options.status,
        userId,
        vehicleType: options.type,
        ...(search
          ? {
              OR: ['nickname', 'brand', 'model', 'color', 'licensePlate'].map(
                (field) => ({
                  [field]: { contains: search, mode: 'insensitive' },
                }),
              ),
            }
          : {}),
      },
    });
  }
}
