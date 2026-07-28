import { createMockApiClients } from '@/api/mock-api';

describe('mock profile and garage API', () => {
  const api = createMockApiClients();

  it('updates profile preferences and registers an idempotent deletion request', async () => {
    const initial = await api.users.getMe();
    const updated = await api.users.update({
      firstName: 'Marina',
      notifications: { promotions: true },
      preferences: { dataSaver: true },
      privacy: { analyticsConsent: true },
      recordVersion: initial.recordVersion,
      theme: 'DARK',
    });
    expect(updated).toMatchObject({
      firstName: 'Marina',
      notifications: { promotions: true },
      preferences: { dataSaver: true },
      privacy: { analyticsConsent: true },
      theme: 'DARK',
    });

    await expect(
      api.users.update({
        firstName: 'Stale',
        recordVersion: initial.recordVersion,
      }),
    ).rejects.toThrow('perfil foi alterado');

    const deletion = await api.users.requestDeletion(updated.recordVersion);
    expect(deletion.accountDeletionRequestedAt).toBeDefined();
  });

  it('runs CRUD, filtering, default selection, duplication and removal', async () => {
    const created = await api.vehicles.create({
      batteryCapacityKwh: 1.4,
      brand: 'Solis',
      color: 'Verde',
      isDefault: false,
      licensePlate: 'TST9A99',
      model: 'Hybrid',
      nickname: 'Híbrido de teste',
      status: 'ACTIVE',
      supportedPlugTypes: [],
      vehicleType: 'HEV',
      year: 2026,
    });
    expect(await api.vehicles.getById(created.id)).toEqual(created);
    expect(
      await api.vehicles.list({
        search: 'hibrido',
        sortBy: 'nickname',
        sortOrder: 'asc',
        status: 'ACTIVE',
        type: 'HEV',
      }),
    ).toEqual([created]);

    const edited = await api.vehicles.update(created.id, {
      color: 'Azul',
      recordVersion: created.recordVersion,
    });
    expect(edited.color).toBe('Azul');

    await expect(
      api.vehicles.update(created.id, {
        color: 'Branco',
        recordVersion: created.recordVersion,
      }),
    ).rejects.toThrow('veículo foi alterado');

    const primary = await api.vehicles.setDefault(
      created.id,
      edited.recordVersion,
    );
    expect(primary.isDefault).toBe(true);
    const copy = await api.vehicles.duplicate(
      created.id,
      primary.recordVersion,
    );
    expect(copy).toMatchObject({
      isDefault: false,
      nickname: 'Híbrido de teste (cópia)',
    });

    await api.vehicles.remove(copy.id, copy.recordVersion);
    await api.vehicles.remove(created.id, primary.recordVersion);
    await expect(api.vehicles.getById(created.id)).rejects.toThrow(
      'Veículo não encontrado',
    );
  });

  it('rejects duplicate identifiers and protects the current primary vehicle', async () => {
    const current = (await api.vehicles.list()).find(
      (vehicle) => vehicle.isDefault,
    )!;
    await expect(
      api.vehicles.create({
        batteryCapacityKwh: 50,
        brand: 'Duplicado',
        isDefault: false,
        licensePlate: current.licensePlate!,
        model: 'Plate',
        nickname: 'Duplicado',
        status: 'ACTIVE',
        supportedPlugTypes: ['CCS2'],
        vehicleType: 'BEV',
      }),
    ).rejects.toThrow('placa ou VIN');

    await expect(
      api.vehicles.update(current.id, {
        isDefault: false,
        recordVersion: current.recordVersion,
      }),
    ).rejects.toThrow('principal primeiro');
  });
});
