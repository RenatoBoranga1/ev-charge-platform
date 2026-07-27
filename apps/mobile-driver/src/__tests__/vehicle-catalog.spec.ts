import {
  filterAndSortVehicles,
  maskLicensePlate,
  vehicleStatusLabel,
  vehicleTypeLabel,
} from '@/garage/vehicle-catalog';
import { mockVehicles } from '@/mocks/data';

describe('vehicle catalog', () => {
  it('searches without accents and filters by type and status', () => {
    expect(
      filterAndSortVehicles(mockVehicles, {
        search: 'familia',
        status: 'ACTIVE',
        type: 'PHEV',
      }).map((vehicle) => vehicle.id),
    ).toEqual([mockVehicles[1]?.id]);

    expect(
      filterAndSortVehicles(mockVehicles, { search: 'inexistente' }),
    ).toEqual([]);
  });

  it('sorts while keeping the primary vehicle first', () => {
    const peers = mockVehicles.map((vehicle, index) => ({
      ...vehicle,
      createdAt: index === 0 ? '2026-01-01T00:00:00.000Z' : '2026-02-01T00:00:00.000Z',
      isDefault: false,
      year: index === 0 ? 2023 : 2024,
    }));
    const byNickname = filterAndSortVehicles(mockVehicles, {
      sortBy: 'nickname',
      sortOrder: 'asc',
    });
    const byYear = filterAndSortVehicles(peers, {
      sortBy: 'year',
      sortOrder: 'desc',
    });
    const byCreatedAt = filterAndSortVehicles(peers, {
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    const byBrand = filterAndSortVehicles(peers, {
      sortBy: 'brand',
      sortOrder: 'desc',
    });

    expect(byNickname[0]?.isDefault).toBe(true);
    expect(byYear[0]?.year).toBe(2024);
    expect(byCreatedAt[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(byBrand).toHaveLength(2);
  });

  it('masks license plates safely', () => {
    expect(maskLicensePlate()).toBeUndefined();
    expect(maskLicensePlate('A1')).toBe('••••');
    expect(maskLicensePlate('BRA-2E19')).toBe('BR•••19');
  });

  it('maps all vehicle labels', () => {
    expect(vehicleTypeLabel('BEV')).toBe('Elétrico');
    expect(vehicleTypeLabel('PHEV')).toBe('Híbrido plug-in');
    expect(vehicleTypeLabel('HEV')).toBe('Híbrido');
    expect(vehicleStatusLabel('ACTIVE')).toBe('Ativo');
    expect(vehicleStatusLabel('INACTIVE')).toBe('Inativo');
    expect(vehicleStatusLabel('SOLD')).toBe('Vendido');
  });

  it('matches secondary searchable fields and descending strings', () => {
    const byBrand = filterAndSortVehicles(mockVehicles, {
      search: mockVehicles[0]!.brand,
      sortBy: 'brand',
      sortOrder: 'desc',
    });
    const byPlate = filterAndSortVehicles(mockVehicles, {
      search: mockVehicles[0]!.licensePlate!,
    });
    const inactive = filterAndSortVehicles(mockVehicles, {
      status: 'INACTIVE',
    });

    expect(byBrand.length).toBeGreaterThan(0);
    expect(byPlate[0]?.id).toBe(mockVehicles[0]?.id);
    expect(inactive.every((vehicle) => vehicle.status === 'INACTIVE')).toBe(true);
  });
});
