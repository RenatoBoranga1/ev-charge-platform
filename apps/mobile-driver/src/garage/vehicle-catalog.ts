import type {
  Vehicle,
  VehicleListFilters,
} from '@/types/domain';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function valueForSort(
  vehicle: Vehicle,
  sortBy: NonNullable<VehicleListFilters['sortBy']>,
): number | string {
  if (sortBy === 'year') return vehicle.year ?? 0;
  if (sortBy === 'createdAt') return Date.parse(vehicle.createdAt);
  return normalize(vehicle[sortBy]);
}

export function filterAndSortVehicles(
  vehicles: readonly Vehicle[],
  filters: VehicleListFilters = {},
): Vehicle[] {
  const search = filters.search ? normalize(filters.search) : '';
  const sortBy = filters.sortBy ?? 'createdAt';
  const direction = filters.sortOrder === 'asc' ? 1 : -1;

  return vehicles
    .filter((vehicle) => {
      if (filters.type && vehicle.vehicleType !== filters.type) return false;
      if (filters.status && vehicle.status !== filters.status) return false;
      if (!search) return true;
      return [
        vehicle.nickname,
        vehicle.brand,
        vehicle.model,
        vehicle.version,
        vehicle.color,
        vehicle.licensePlate,
      ].some((value) => value && normalize(value).includes(search));
    })
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
      const leftValue = valueForSort(left, sortBy);
      const rightValue = valueForSort(right, sortBy);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * direction;
      }
      return (
        String(leftValue).localeCompare(String(rightValue), 'pt-BR') * direction
      );
    });
}

export function maskLicensePlate(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (normalized.length < 4) return '••••';
  return `${normalized.slice(0, 2)}•••${normalized.slice(-2)}`;
}

export function vehicleTypeLabel(type: Vehicle['vehicleType']): string {
  if (type === 'BEV') return 'Elétrico';
  if (type === 'PHEV') return 'Híbrido plug-in';
  return 'Híbrido';
}

export function vehicleStatusLabel(status: Vehicle['status']): string {
  if (status === 'ACTIVE') return 'Ativo';
  if (status === 'INACTIVE') return 'Inativo';
  return 'Vendido';
}
