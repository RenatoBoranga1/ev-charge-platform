import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChargingSessionStatus,
  Prisma,
  VehicleStatus,
  VehicleType,
  type Vehicle,
} from '@solis/database';

import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import { DomainEventPublisher } from '../outbox/domain-event-publisher';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { ListVehiclesDto } from './dto/list-vehicles.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import {
  type VehicleDto,
  toVehicleDto,
} from './vehicle.presenter';
import { VehicleRepository } from './vehicle.repository';

const activeChargingStatuses = [
  ChargingSessionStatus.PENDING,
  ChargingSessionStatus.AUTHORIZED,
  ChargingSessionStatus.STARTING,
  ChargingSessionStatus.CHARGING,
  ChargingSessionStatus.STOPPING,
];

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIdentifier(value?: string): string | undefined {
  const normalized = value?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return normalized ? normalized : undefined;
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: VehicleRepository,
    private readonly outbox: DomainEventPublisher,
  ) {}

  async listForUser(
    userId: string,
    filters: ListVehiclesDto = {
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
  ): Promise<VehicleDto[]> {
    const vehicles = await this.repository.list(userId, filters);
    return vehicles.map(toVehicleDto);
  }

  async getForUser(userId: string, vehicleId: string): Promise<VehicleDto> {
    return toVehicleDto(await this.requireVehicle(userId, vehicleId));
  }

  async create(
    input: CreateVehicleDto,
    user: AuthUser,
    correlationId: string,
  ): Promise<VehicleDto> {
    this.assertCompatibility(input.vehicleType, input.supportedPlugTypes);
    const licensePlate = normalizeIdentifier(input.licensePlate);
    const vin = normalizeIdentifier(input.vin);
    await this.assertNoDuplicate(user.sub, licensePlate, vin);

    try {
      const vehicle = await this.prisma.$transaction(
        async (transaction) => {
          const existingCount = await transaction.vehicle.count({
            where: { deletedAt: null, userId: user.sub },
          });
          const isDefault = input.isDefault === true || existingCount === 0;
          if (isDefault) {
            await transaction.vehicle.updateMany({
              data: { isDefault: false, version: { increment: 1 } },
              where: { deletedAt: null, isDefault: true, userId: user.sub },
            });
          }
          const created = await transaction.vehicle.create({
            data: {
              averageConsumptionKwhPer100Km:
                input.averageConsumptionKwhPer100Km,
              batteryCapacityKwh: input.batteryCapacityKwh,
              brand: input.brand.trim(),
              color: normalizeOptional(input.color),
              estimatedRangeKm: input.estimatedRangeKm,
              imageUrl: normalizeOptional(input.imageUrl),
              isDefault,
              licensePlate,
              maximumAcPowerKw: input.maximumAcPowerKw,
              maximumDcPowerKw: input.maximumDcPowerKw,
              model: input.model.trim(),
              nickname: input.nickname.trim(),
              notes: normalizeOptional(input.notes),
              status: input.status ?? VehicleStatus.ACTIVE,
              supportedPlugTypes: input.supportedPlugTypes,
              trim: normalizeOptional(input.version),
              userId: user.sub,
              vehicleType: input.vehicleType,
              vin,
              year: input.year,
            },
          });
          await this.recordChange(
            transaction,
            'VEHICLE_CREATED',
            created,
            user,
            correlationId,
          );
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return toVehicleDto(vehicle);
    } catch (error) {
      this.rethrowPersistenceConflict(error);
    }
  }

  async update(
    vehicleId: string,
    input: UpdateVehicleDto,
    user: AuthUser,
    correlationId: string,
  ): Promise<VehicleDto> {
    const current = await this.requireVehicle(user.sub, vehicleId);
    const vehicleType = input.vehicleType ?? current.vehicleType;
    const plugs = input.supportedPlugTypes ?? current.supportedPlugTypes;
    this.assertCompatibility(vehicleType, plugs);
    if (current.isDefault && input.isDefault === false) {
      throw new ConflictException({
        code: 'DEFAULT_VEHICLE_REQUIRED',
        message: 'Defina outro veículo como principal antes desta alteração.',
      });
    }
    if (
      input.isDefault === true &&
      input.status !== undefined &&
      input.status !== VehicleStatus.ACTIVE
    ) {
      throw new BadRequestException('O veículo principal deve estar ativo.');
    }

    const licensePlate =
      input.licensePlate === undefined
        ? current.licensePlate ?? undefined
        : normalizeIdentifier(input.licensePlate);
    const vin =
      input.vin === undefined
        ? current.vin ?? undefined
        : normalizeIdentifier(input.vin);
    await this.assertNoDuplicate(user.sub, licensePlate, vin, current.id);

    try {
      const updated = await this.prisma.$transaction(
        async (transaction) => {
          if (input.isDefault === true && !current.isDefault) {
            await transaction.vehicle.updateMany({
              data: { isDefault: false, version: { increment: 1 } },
              where: { deletedAt: null, isDefault: true, userId: user.sub },
            });
          }
          const result = await transaction.vehicle.updateMany({
            data: {
              ...(input.averageConsumptionKwhPer100Km !== undefined
                ? {
                    averageConsumptionKwhPer100Km:
                      input.averageConsumptionKwhPer100Km,
                  }
                : {}),
              ...(input.batteryCapacityKwh !== undefined
                ? { batteryCapacityKwh: input.batteryCapacityKwh }
                : {}),
              ...(input.brand !== undefined ? { brand: input.brand.trim() } : {}),
              ...(input.color !== undefined
                ? { color: normalizeOptional(input.color) ?? null }
                : {}),
              ...(input.estimatedRangeKm !== undefined
                ? { estimatedRangeKm: input.estimatedRangeKm }
                : {}),
              ...(input.imageUrl !== undefined
                ? { imageUrl: normalizeOptional(input.imageUrl) ?? null }
                : {}),
              ...(input.isDefault !== undefined
                ? { isDefault: input.isDefault }
                : {}),
              ...(input.licensePlate !== undefined
                ? { licensePlate: licensePlate ?? null }
                : {}),
              ...(input.maximumAcPowerKw !== undefined
                ? { maximumAcPowerKw: input.maximumAcPowerKw }
                : {}),
              ...(input.maximumDcPowerKw !== undefined
                ? { maximumDcPowerKw: input.maximumDcPowerKw }
                : {}),
              ...(input.model !== undefined ? { model: input.model.trim() } : {}),
              ...(input.nickname !== undefined
                ? { nickname: input.nickname.trim() }
                : {}),
              ...(input.notes !== undefined
                ? { notes: normalizeOptional(input.notes) ?? null }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              ...(input.supportedPlugTypes !== undefined
                ? { supportedPlugTypes: input.supportedPlugTypes }
                : {}),
              ...(input.version !== undefined
                ? { trim: normalizeOptional(input.version) ?? null }
                : {}),
              ...(input.vehicleType !== undefined
                ? { vehicleType: input.vehicleType }
                : {}),
              ...(input.vin !== undefined ? { vin: vin ?? null } : {}),
              ...(input.year !== undefined ? { year: input.year } : {}),
              version: { increment: 1 },
            },
            where: {
              deletedAt: null,
              id: vehicleId,
              userId: user.sub,
              version: input.recordVersion,
            },
          });
          if (result.count !== 1) this.optimisticLockConflict();
          const vehicle = await transaction.vehicle.findUniqueOrThrow({
            where: { id: vehicleId },
          });
          await this.recordChange(
            transaction,
            'VEHICLE_UPDATED',
            vehicle,
            user,
            correlationId,
            current,
          );
          return vehicle;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return toVehicleDto(updated);
    } catch (error) {
      this.rethrowPersistenceConflict(error);
    }
  }

  async setDefault(
    vehicleId: string,
    recordVersion: number,
    user: AuthUser,
    correlationId: string,
  ): Promise<VehicleDto> {
    const current = await this.requireVehicle(user.sub, vehicleId);
    if (current.status !== VehicleStatus.ACTIVE) {
      throw new ConflictException('Somente um veículo ativo pode ser principal.');
    }
    if (current.isDefault) return toVehicleDto(current);

    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.vehicle.updateMany({
        data: { isDefault: false, version: { increment: 1 } },
        where: { deletedAt: null, isDefault: true, userId: user.sub },
      });
      const result = await transaction.vehicle.updateMany({
        data: { isDefault: true, version: { increment: 1 } },
        where: {
          deletedAt: null,
          id: vehicleId,
          userId: user.sub,
          version: recordVersion,
        },
      });
      if (result.count !== 1) this.optimisticLockConflict();
      const vehicle = await transaction.vehicle.findUniqueOrThrow({
        where: { id: vehicleId },
      });
      await this.recordChange(
        transaction,
        'VEHICLE_SET_DEFAULT',
        vehicle,
        user,
        correlationId,
        current,
      );
      return vehicle;
    });
    return toVehicleDto(updated);
  }

  async duplicate(
    vehicleId: string,
    recordVersion: number,
    user: AuthUser,
    correlationId: string,
  ): Promise<VehicleDto> {
    const current = await this.requireVehicle(user.sub, vehicleId);
    if (current.version !== recordVersion) this.optimisticLockConflict();
    return this.create(
      {
        averageConsumptionKwhPer100Km:
          current.averageConsumptionKwhPer100Km
            ? Number(current.averageConsumptionKwhPer100Km)
            : undefined,
        batteryCapacityKwh: Number(current.batteryCapacityKwh),
        brand: current.brand,
        color: current.color ?? undefined,
        estimatedRangeKm: current.estimatedRangeKm ?? undefined,
        imageUrl: current.imageUrl ?? undefined,
        isDefault: false,
        maximumAcPowerKw: current.maximumAcPowerKw
          ? Number(current.maximumAcPowerKw)
          : undefined,
        maximumDcPowerKw: current.maximumDcPowerKw
          ? Number(current.maximumDcPowerKw)
          : undefined,
        model: current.model,
        nickname: `${current.nickname} (cópia)`.slice(0, 60),
        notes: current.notes ?? undefined,
        status: VehicleStatus.ACTIVE,
        supportedPlugTypes: current.supportedPlugTypes,
        vehicleType: current.vehicleType,
        version: current.trim ?? undefined,
        year: current.year ?? undefined,
      },
      user,
      correlationId,
    );
  }

  async remove(
    vehicleId: string,
    recordVersion: number,
    user: AuthUser,
    correlationId: string,
  ): Promise<void> {
    const current = await this.requireVehicle(user.sub, vehicleId);
    const activeSession = await this.prisma.chargingSession.findFirst({
      select: { id: true },
      where: {
        deletedAt: null,
        status: { in: activeChargingStatuses },
        vehicleId,
      },
    });
    if (activeSession) {
      throw new ConflictException({
        code: 'VEHICLE_HAS_ACTIVE_SESSION',
        message: 'Encerre a recarga ativa antes de remover o veículo.',
      });
    }

    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.vehicle.updateMany({
        data: {
          deletedAt: new Date(),
          isDefault: false,
          version: { increment: 1 },
        },
        where: {
          deletedAt: null,
          id: vehicleId,
          userId: user.sub,
          version: recordVersion,
        },
      });
      if (result.count !== 1) this.optimisticLockConflict();
      if (current.isDefault) {
        const replacement = await transaction.vehicle.findFirst({
          orderBy: { createdAt: 'asc' },
          where: {
            deletedAt: null,
            id: { not: vehicleId },
            status: VehicleStatus.ACTIVE,
            userId: user.sub,
          },
        });
        if (replacement) {
          await transaction.vehicle.update({
            data: { isDefault: true, version: { increment: 1 } },
            where: { id: replacement.id },
          });
        }
      }
      await transaction.auditLog.create({
        data: {
          action: 'VEHICLE_REMOVED',
          before: {
            isDefault: current.isDefault,
            status: current.status,
            version: current.version,
          },
          correlationId,
          entityId: current.id,
          entityType: 'Vehicle',
          tenantId: user.tenantId,
          userId: user.sub,
        },
      });
      await this.outbox.publish(
        {
          aggregateId: current.id,
          aggregateType: 'Vehicle',
          eventType: 'VehicleRemoved',
          payload: { correlationId, userId: user.sub },
          tenantId: user.tenantId,
        },
        transaction,
      );
    });
  }

  private assertCompatibility(
    vehicleType: VehicleType,
    supportedPlugTypes: readonly string[],
  ): void {
    if (
      vehicleType !== VehicleType.HEV &&
      supportedPlugTypes.length === 0
    ) {
      throw new BadRequestException(
        'Informe ao menos um conector para veículos BEV ou PHEV.',
      );
    }
  }

  private async assertNoDuplicate(
    userId: string,
    licensePlate?: string,
    vin?: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.repository.findDuplicate(
      userId,
      licensePlate,
      vin,
      excludeId,
    );
    if (duplicate) {
      throw new ConflictException({
        code: 'VEHICLE_DUPLICATE',
        message: 'Já existe um veículo com esta placa ou VIN na garagem.',
      });
    }
  }

  private async recordChange(
    transaction: Prisma.TransactionClient,
    action: string,
    vehicle: Vehicle,
    user: AuthUser,
    correlationId: string,
    before?: Vehicle,
  ): Promise<void> {
    await transaction.auditLog.create({
      data: {
        action,
        after: {
          isDefault: vehicle.isDefault,
          status: vehicle.status,
          version: vehicle.version,
        },
        before: before
          ? {
              isDefault: before.isDefault,
              status: before.status,
              version: before.version,
            }
          : undefined,
        correlationId,
        entityId: vehicle.id,
        entityType: 'Vehicle',
        tenantId: user.tenantId,
        userId: user.sub,
      },
    });
    await this.outbox.publish(
      {
        aggregateId: vehicle.id,
        aggregateType: 'Vehicle',
        eventType: action
          .toLowerCase()
          .replace(/(^|_)([a-z])/g, (_match, _separator, character: string) =>
            character.toUpperCase(),
          ),
        payload: {
          correlationId,
          isDefault: vehicle.isDefault,
          status: vehicle.status,
          userId: user.sub,
          version: vehicle.version,
        },
        tenantId: user.tenantId,
      },
      transaction,
    );
  }

  private async requireVehicle(
    userId: string,
    vehicleId: string,
  ): Promise<Vehicle> {
    const vehicle = await this.repository.findById(userId, vehicleId);
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    return vehicle;
  }

  private optimisticLockConflict(): never {
    throw new ConflictException({
      code: 'OPTIMISTIC_LOCK_CONFLICT',
      message: 'O veículo foi alterado em outro dispositivo. Atualize e tente novamente.',
    });
  }

  private rethrowPersistenceConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      throw new ConflictException({
        code: 'VEHICLE_CONFLICT',
        message: 'A garagem mudou durante a operação. Atualize e tente novamente.',
      });
    }
    throw error;
  }
}
