import { randomUUID } from 'node:crypto';
import {
  PlugType,
  ProfileTheme,
  UserRole,
  VehicleStatus,
  VehicleType,
} from '@solis/database';

import type { AuthUser } from '../src/auth/auth-user';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxEventPublisher } from '../src/outbox/outbox-event.publisher';
import { UserProfileService } from '../src/users/user-profile.service';
import {
  PrismaVehicleRepository,
  VehicleRepository,
} from '../src/vehicles/vehicle.repository';
import { VehiclesService } from '../src/vehicles/vehicles.service';

const describeDatabase =
  process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Profile and smart garage database integration', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const userId = randomUUID();
  const authUser: AuthUser = {
    email: 'phase3.integration@solis.local',
    role: UserRole.DRIVER,
    sub: userId,
    tenantId,
  };
  const publisher = new OutboxEventPublisher(prisma);
  const repository: VehicleRepository = new PrismaVehicleRepository(prisma);
  const profiles = new UserProfileService(prisma, publisher);
  const vehicles = new VehiclesService(prisma, repository, publisher);
  let correlationSequence = 0;

  const correlationId = () => `phase3-integration-${++correlationSequence}`;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Phase 3 integration',
        slug: `phase3-integration-${tenantId}`,
      },
    });
    await prisma.user.create({
      data: {
        email: authUser.email,
        id: userId,
        name: 'Test Driver',
        passwordHash: 'integration-only',
        role: UserRole.DRIVER,
        tenantId,
      },
    });
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.outboxEvent.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { userId } });
    await prisma.user.update({
      data: {
        accountDeletionRequestedAt: null,
        avatarUrl: null,
        city: null,
        country: 'BR',
        email: authUser.email,
        firstName: null,
        language: 'pt-BR',
        lastName: null,
        name: 'Test Driver',
        notificationPreferences: undefined,
        phone: null,
        preferences: undefined,
        privacyPreferences: undefined,
        state: null,
        theme: ProfileTheme.SYSTEM,
        version: 1,
      },
      where: { id: userId },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.outboxEvent.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('persists the complete profile with audit, outbox and idempotent LGPD request', async () => {
    const initial = await profiles.getProfile(userId);
    expect(initial).toMatchObject({
      country: 'BR',
      firstName: 'Test',
      language: 'pt-BR',
      lastName: 'Driver',
      recordVersion: 1,
      theme: ProfileTheme.SYSTEM,
    });

    const updated = await profiles.updateProfile(
      {
        avatarUrl: 'https://cdn.solis.local/avatar.png',
        city: 'Curitiba',
        country: 'br',
        email: 'updated.phase3@solis.local',
        firstName: 'Marina',
        language: 'pt-BR',
        lastName: 'Souza',
        notifications: {
          chargingNotifications: false,
          promotions: true,
        },
        phone: '+55 41 99999-9999',
        preferences: { dataSaver: true },
        privacy: {
          analyticsConsent: true,
          marketingConsent: false,
        },
        recordVersion: initial.recordVersion,
        state: 'pr',
        theme: ProfileTheme.DARK,
      },
      authUser,
      correlationId(),
    );

    expect(updated).toMatchObject({
      avatarUrl: 'https://cdn.solis.local/avatar.png',
      city: 'Curitiba',
      country: 'BR',
      email: 'updated.phase3@solis.local',
      firstName: 'Marina',
      language: 'pt-BR',
      lastName: 'Souza',
      name: 'Marina Souza',
      notifications: {
        chargingNotifications: false,
        promotions: true,
      },
      phone: '+55 41 99999-9999',
      preferences: { dataSaver: true },
      privacy: {
        analyticsConsent: true,
        marketingConsent: false,
      },
      recordVersion: 2,
      state: 'PR',
      theme: ProfileTheme.DARK,
    });

    const deletion = await profiles.requestAccountDeletion(
      authUser,
      updated.recordVersion,
      correlationId(),
    );
    const repeated = await profiles.requestAccountDeletion(
      authUser,
      updated.recordVersion,
      correlationId(),
    );
    expect(deletion.accountDeletionRequestedAt).toBeDefined();
    expect(repeated.accountDeletionRequestedAt).toBe(
      deletion.accountDeletionRequestedAt,
    );
    expect(await prisma.auditLog.count({ where: { tenantId } })).toBe(2);
    expect(await prisma.outboxEvent.count({ where: { tenantId } })).toBe(2);
  });

  it('allows only one concurrent profile update for the same version', async () => {
    const initial = await profiles.getProfile(userId);
    const attempts = await Promise.allSettled([
      profiles.updateProfile(
        {
          firstName: 'First',
          recordVersion: initial.recordVersion,
        },
        authUser,
        correlationId(),
      ),
      profiles.updateProfile(
        {
          firstName: 'Second',
          recordVersion: initial.recordVersion,
        },
        authUser,
        correlationId(),
      ),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
  });

  it('runs vehicle CRUD, search, filters, sorting, duplication and default promotion', async () => {
    const first = await vehicles.create(
      {
        batteryCapacityKwh: 64,
        brand: 'Aurora',
        estimatedRangeKm: 430,
        licensePlate: 'BRA2E19',
        maximumAcPowerKw: 11,
        maximumDcPowerKw: 150,
        model: 'E1',
        nickname: 'Carro principal',
        status: VehicleStatus.ACTIVE,
        supportedPlugTypes: [PlugType.CCS2, PlugType.TYPE_2],
        vehicleType: VehicleType.BEV,
        year: 2025,
      },
      authUser,
      correlationId(),
    );
    const second = await vehicles.create(
      {
        batteryCapacityKwh: 18.3,
        brand: 'Horizonte',
        model: 'P2',
        nickname: 'Carro da família',
        supportedPlugTypes: [PlugType.TYPE_2],
        vehicleType: VehicleType.PHEV,
        vin: '9BWZZZ377VT004251',
        year: 2024,
      },
      authUser,
      correlationId(),
    );

    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
    expect(await vehicles.getForUser(userId, first.id)).toMatchObject({
      licensePlate: 'BRA2E19',
      nickname: 'Carro principal',
    });
    expect(
      await vehicles.listForUser(userId, {
        search: 'família',
        sortBy: 'nickname',
        sortOrder: 'asc',
        status: VehicleStatus.ACTIVE,
        type: VehicleType.PHEV,
      }),
    ).toHaveLength(1);

    const edited = await vehicles.update(
      second.id,
      {
        color: 'Azul',
        isDefault: true,
        nickname: 'Família elétrica',
        recordVersion: second.recordVersion,
      },
      authUser,
      correlationId(),
    );
    expect(edited).toMatchObject({
      color: 'Azul',
      isDefault: true,
      nickname: 'Família elétrica',
    });

    const duplicated = await vehicles.duplicate(
      edited.id,
      edited.recordVersion,
      authUser,
      correlationId(),
    );
    expect(duplicated).toMatchObject({
      isDefault: false,
      nickname: 'Família elétrica (cópia)',
    });
    expect(duplicated.vin).toBeUndefined();

    await vehicles.remove(
      edited.id,
      edited.recordVersion,
      authUser,
      correlationId(),
    );
    const remaining = await vehicles.listForUser(userId);
    expect(remaining).toHaveLength(2);
    expect(remaining.some((vehicle) => vehicle.isDefault)).toBe(true);
    expect(await prisma.auditLog.count({ where: { tenantId } })).toBe(5);
    expect(await prisma.outboxEvent.count({ where: { tenantId } })).toBe(5);
  });

  it('rejects duplicate identifiers and stale concurrent updates', async () => {
    const vehicle = await vehicles.create(
      {
        batteryCapacityKwh: 52,
        brand: 'Nexo',
        licensePlate: 'ABC1D23',
        model: 'Urban',
        nickname: 'Nexo urbano',
        supportedPlugTypes: [PlugType.CCS2],
        vehicleType: VehicleType.BEV,
      },
      authUser,
      correlationId(),
    );

    await expect(
      vehicles.create(
        {
          batteryCapacityKwh: 60,
          brand: 'Outra',
          licensePlate: 'abc-1d23',
          model: 'Duplicado',
          nickname: 'Duplicado',
          supportedPlugTypes: [PlugType.CCS2],
          vehicleType: VehicleType.BEV,
        },
        authUser,
        correlationId(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_DUPLICATE' },
    });

    const attempts = await Promise.allSettled([
      vehicles.update(
        vehicle.id,
        { color: 'Preto', recordVersion: vehicle.recordVersion },
        authUser,
        correlationId(),
      ),
      vehicles.update(
        vehicle.id,
        { color: 'Branco', recordVersion: vehicle.recordVersion },
        authUser,
        correlationId(),
      ),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
  });

  it('enforces a single active default vehicle at the database boundary', async () => {
    const base = {
      batteryCapacityKwh: 50,
      brand: 'Boundary',
      isDefault: true,
      model: 'Constraint',
      supportedPlugTypes: [PlugType.CCS2],
      userId,
      vehicleType: VehicleType.BEV,
    };
    await prisma.vehicle.create({ data: { ...base, nickname: 'Primeiro' } });
    await expect(
      prisma.vehicle.create({ data: { ...base, nickname: 'Segundo' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
