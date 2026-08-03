import * as argon2 from 'argon2';

import {
  AuditOutcome,
  ChargerProtocol,
  ConnectorStatus,
  CurrentType,
  LedgerAccountOwnerType,
  LedgerAccountStatus,
  LedgerAccountType,
  LedgerDirection,
  LedgerTransactionStatus,
  LedgerTransactionType,
  PaymentIntentStatus,
  PaymentIntentType,
  PaymentReconciliationStatus,
  PaymentMethodStatus,
  PaymentMethodType,
  PlugType,
  OperatorMembershipStatus,
  OperatorRole,
  Prisma,
  PrismaClient,
  ProfileTheme,
  ReceiptStatus,
  RemoteCommandStatus,
  RemoteCommandType,
  RefundStatus,
  StationStatus,
  TariffPublicationStatus,
  UserRole,
  VehicleStatus,
  VehicleType,
  WalletReservationStatus,
  WalletStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
  adminAudit: 'a0000000-0000-4000-8000-000000000001',
  adminMembership: 'a0000000-0000-4000-8000-000000000002',
  adminUser: 'a0000000-0000-4000-8000-000000000003',
  demoOperatorUser: 'a0000000-0000-4000-8000-000000000004',
  demoOperatorMembership: 'a0000000-0000-4000-8000-000000000005',
  demoFinanceUser: 'a0000000-0000-4000-8000-000000000006',
  demoFinanceMembership: 'a0000000-0000-4000-8000-000000000007',
  demoViewerUser: 'a0000000-0000-4000-8000-000000000008',
  demoViewerMembership: 'a0000000-0000-4000-8000-000000000009',
  demoRemoteCommand: 'a0000000-0000-4000-8000-000000000010',
  demoReconciliation: 'a0000000-0000-4000-8000-000000000011',
  demoDraftTariff: 'a0000000-0000-4000-8000-000000000012',
  autoRecharge: 'b0000000-0000-4000-8000-000000000001',
  demoSession: 'b0000000-0000-4000-8000-000000000002',
  failedPayment: 'b0000000-0000-4000-8000-000000000003',
  paymentMethod: 'b0000000-0000-4000-8000-000000000004',
  pendingPayment: 'b0000000-0000-4000-8000-000000000005',
  receipt: 'b0000000-0000-4000-8000-000000000006',
  refund: 'b0000000-0000-4000-8000-000000000007',
  refundedPayment: 'b0000000-0000-4000-8000-000000000008',
  sessionPayment: 'b0000000-0000-4000-8000-000000000009',
  topUpPayment: 'b0000000-0000-4000-8000-000000000010',
  wallet: 'b0000000-0000-4000-8000-000000000011',
  walletAvailable: 'b0000000-0000-4000-8000-000000000012',
  walletClearing: 'b0000000-0000-4000-8000-000000000013',
  walletRefund: 'b0000000-0000-4000-8000-000000000014',
  walletReserved: 'b0000000-0000-4000-8000-000000000015',
  walletRevenue: 'b0000000-0000-4000-8000-000000000016',
  connectorOne: 'd7d92f80-36a3-47ec-bf60-b931453bdb39',
  connectorThree: 'e6eb9afe-014b-4ec0-9601-3292b2c59191',
  connectorTwo: 'e6b90a41-ea5e-4b2f-9a73-13de0f4f9871',
  evseOne: '13467910-0537-4b8a-a2de-e359df8ba7dc',
  operator: '10101010-1010-4010-8010-101010101010',
  stationOne: 'ef5a80bb-2090-45cb-83cd-bc04fc5e9a01',
  stationThree: 'c664b28c-6041-4715-88dd-07c714a80fb0',
  stationTwo: '17b6a3df-b741-4c6f-a5dd-f75b5e5c831f',
  tenant: '20202020-2020-4020-8020-202020202020',
  user: 'b42d2c13-bf73-44c8-8c51-0c2369b8fe0b',
  vehicle: 'f2a7441f-e197-44df-8e90-aa21d643fa37',
};

interface StationSeed {
  address: string;
  chargePointId: string;
  city: string;
  code: string;
  connectorId: string;
  currentType: CurrentType;
  evseId: string;
  ocppIdentity?: string;
  protocol?: ChargerProtocol;
  externalCode: string;
  hasParking: boolean;
  id: string;
  isOpen24Hours: boolean;
  latitude: number;
  longitude: number;
  maximumPowerKw: number;
  name: string;
  openingHours: string;
  plugType: PlugType;
  pricePerKwh: number;
  rating: number;
  state: string;
  status: StationStatus;
}

const stations: StationSeed[] = [
  {
    address: 'Av. Ipiranga, 320',
    chargePointId: 'd744cb1e-9799-49f2-807c-f7e583cb30dc',
    city: 'São Paulo',
    code: 'SOLIS-001-A',
    connectorId: ids.connectorOne,
    currentType: CurrentType.DC,
    evseId: ids.evseOne,
    externalCode: 'CP-SOLIS-001',
    hasParking: true,
    id: ids.stationOne,
    isOpen24Hours: true,
    latitude: -23.55052,
    longitude: -46.633308,
    maximumPowerKw: 150,
    name: 'Solis Centro',
    openingHours: 'Aberta 24 horas',
    plugType: PlugType.CCS2,
    pricePerKwh: 2.19,
    rating: 4.8,
    state: 'SP',
    status: StationStatus.AVAILABLE,
  },
  {
    address: 'Al. Santos, 1800',
    chargePointId: '30303030-3030-4030-8030-303030303030',
    city: 'São Paulo',
    code: 'SOLIS-002-A',
    connectorId: ids.connectorTwo,
    currentType: CurrentType.DC,
    evseId: '40404040-4040-4040-8040-404040404040',
    externalCode: 'CP-SOLIS-002',
    hasParking: true,
    id: ids.stationTwo,
    isOpen24Hours: false,
    latitude: -23.56141,
    longitude: -46.655881,
    maximumPowerKw: 60,
    name: 'Solis Parque',
    openingHours: '06:00–23:00',
    plugType: PlugType.CCS2,
    pricePerKwh: 1.89,
    rating: 4.5,
    state: 'SP',
    status: StationStatus.OCCUPIED,
  },
  {
    address: 'R. Afonso Braz, 420',
    chargePointId: '50505050-5050-4050-8050-505050505050',
    city: 'São Paulo',
    code: 'SOLIS-003-A',
    connectorId: ids.connectorThree,
    currentType: CurrentType.DC,
    evseId: '60606060-6060-4060-8060-606060606060',
    externalCode: 'CP-SOLIS-003',
    hasParking: false,
    id: ids.stationThree,
    isOpen24Hours: true,
    latitude: -23.59245,
    longitude: -46.67218,
    maximumPowerKw: 120,
    name: 'Solis Vila Nova',
    ocppIdentity: 'SOLIS-OCPP-001',
    openingHours: 'Aberta 24 horas',
    plugType: PlugType.CCS2,
    pricePerKwh: 2.05,
    protocol: ChargerProtocol.OCPP16,
    rating: 4.3,
    state: 'SP',
    status: StationStatus.PARTIAL,
  },
];

async function seedStation(
  input: StationSeed,
  ocppAuthSecretHash?: string,
): Promise<void> {
  await prisma.station.upsert({
    where: { id: input.id },
    update: {
      address: input.address,
      city: input.city,
      hasParking: input.hasParking,
      isOpen24Hours: input.isOpen24Hours,
      latitude: input.latitude,
      longitude: input.longitude,
      name: input.name,
      openingHours: input.openingHours,
      rating: input.rating,
      status: input.status,
    },
    create: {
      address: input.address,
      city: input.city,
      country: 'BR',
      hasParking: input.hasParking,
      id: input.id,
      isOpen24Hours: input.isOpen24Hours,
      latitude: input.latitude,
      longitude: input.longitude,
      name: input.name,
      openingHours: input.openingHours,
      operatorId: ids.operator,
      rating: input.rating,
      state: input.state,
      status: input.status,
      tenantId: ids.tenant,
    },
  });
  await prisma.$executeRaw(Prisma.sql`
    UPDATE stations
    SET location = ST_SetSRID(
      ST_MakePoint(${input.longitude}, ${input.latitude}),
      4326
    )::geography
    WHERE id = ${input.id}::uuid
  `);

  await prisma.chargePoint.upsert({
    where: { id: input.chargePointId },
    update: {
      ocppAuthSecretHash: input.ocppIdentity ? ocppAuthSecretHash : null,
      ocppEnabled: input.protocol === ChargerProtocol.OCPP16,
      ocppIdentity: input.ocppIdentity ?? null,
      protocol: input.protocol ?? ChargerProtocol.SIMULATOR,
      status: input.status,
    },
    create: {
      externalCode: input.externalCode,
      id: input.chargePointId,
      ocppAuthSecretHash: input.ocppIdentity ? ocppAuthSecretHash : null,
      ocppEnabled: input.protocol === ChargerProtocol.OCPP16,
      ocppIdentity: input.ocppIdentity,
      protocol: input.protocol ?? ChargerProtocol.SIMULATOR,
      stationId: input.id,
      status: input.status,
    },
  });
  await prisma.evse.upsert({
    where: { id: input.evseId },
    update: {
      status:
        input.status === StationStatus.OCCUPIED
          ? ConnectorStatus.OCCUPIED
          : ConnectorStatus.AVAILABLE,
    },
    create: {
      chargePointId: input.chargePointId,
      id: input.evseId,
      status:
        input.status === StationStatus.OCCUPIED
          ? ConnectorStatus.OCCUPIED
          : ConnectorStatus.AVAILABLE,
      uid: `EVSE-${input.externalCode}`,
    },
  });
  await prisma.connector.upsert({
    where: { id: input.connectorId },
    update: {
      maximumPowerKw: input.maximumPowerKw,
      status:
        input.status === StationStatus.OCCUPIED
          ? ConnectorStatus.OCCUPIED
          : ConnectorStatus.AVAILABLE,
    },
    create: {
      code: input.code,
      currentType: input.currentType,
      evseId: input.evseId,
      id: input.connectorId,
      maximumPowerKw: input.maximumPowerKw,
      number: 1,
      plugType: input.plugType,
      status:
        input.status === StationStatus.OCCUPIED
          ? ConnectorStatus.OCCUPIED
          : ConnectorStatus.AVAILABLE,
    },
  });
  const tariffId =
    input.id === ids.stationOne
      ? '70707070-7070-4070-8070-707070707070'
      : input.id === ids.stationTwo
        ? '80808080-8080-4080-8080-808080808080'
        : '90909090-9090-4090-8090-909090909090';
  await prisma.tariff.upsert({
    where: { id: tariffId },
    update: { pricePerKwh: input.pricePerKwh },
    create: {
      id: tariffId,
      name: 'Tarifa padrão',
      operatorId: ids.operator,
      pricePerKwh: input.pricePerKwh,
      stationId: input.id,
    },
  });
}

interface LedgerTransactionSeed {
  chargingSessionId?: string;
  entries: Array<{
    accountId: string;
    amountMinor: bigint;
    direction: LedgerDirection;
  }>;
  id: string;
  idempotencyKey: string;
  paymentIntentId?: string;
  type: LedgerTransactionType;
}

async function seedLedgerTransaction(
  input: LedgerTransactionSeed,
): Promise<void> {
  const existing = await prisma.ledgerTransaction.findUnique({
    where: {
      tenantId_idempotencyKey: {
        idempotencyKey: input.idempotencyKey,
        tenantId: ids.tenant,
      },
    },
  });
  if (existing) return;
  await prisma.ledgerTransaction.create({
    data: {
      chargingSessionId: input.chargingSessionId,
      description: `Seed financeiro: ${input.type}`,
      entries: {
        create: input.entries.map((entry) => ({
          accountId: entry.accountId,
          amountMinor: entry.amountMinor,
          currency: 'BRL',
          direction: entry.direction,
        })),
      },
      id: input.id,
      idempotencyKey: input.idempotencyKey,
      paymentIntentId: input.paymentIntentId,
      requestHash: `seed-${input.idempotencyKey}`,
      tenantId: ids.tenant,
      type: input.type,
    },
  });
  await prisma.ledgerTransaction.update({
    data: { status: LedgerTransactionStatus.POSTED },
    where: { id: input.id },
  });
}

async function main(): Promise<void> {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.info('Seed de demonstração ignorado: defina SEED_DEMO_DATA=true.');
    return;
  }

  await prisma.tenant.upsert({
    where: { slug: 'solis' },
    update: { name: 'Solis Plataformas' },
    create: { id: ids.tenant, name: 'Solis Plataformas', slug: 'solis' },
  });
  await prisma.operator.upsert({
    where: { id: ids.operator },
    update: { name: 'Rede Solis' },
    create: {
      code: 'SOLIS',
      id: ids.operator,
      name: 'Rede Solis',
      tenantId: ids.tenant,
    },
  });

  const passwordHash = await argon2.hash(
    process.env.DEMO_USER_PASSWORD ?? 'solis-demo',
  );
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        email: 'marina.souza@example.com',
        tenantId: ids.tenant,
      },
    },
    update: {
      city: 'São Paulo',
      country: 'BR',
      firstName: 'Marina',
      language: 'pt-BR',
      lastName: 'Souza',
      notificationPreferences: {
        chargingNotifications: true,
        emailReceipts: true,
        favoriteStationAlerts: true,
        promotions: false,
        reservationAlerts: true,
      },
      passwordHash,
      state: 'SP',
      theme: ProfileTheme.SYSTEM,
    },
    create: {
      avoidedCo2Kg: 49.26,
      city: 'São Paulo',
      country: 'BR',
      email: 'marina.souza@example.com',
      estimatedSavings: 214.8,
      firstName: 'Marina',
      id: ids.user,
      language: 'pt-BR',
      lastName: 'Souza',
      name: 'Marina Souza',
      notificationPreferences: {
        chargingNotifications: true,
        emailReceipts: true,
        favoriteStationAlerts: true,
        promotions: false,
        reservationAlerts: true,
      },
      passwordHash,
      phone: '+5511999999999',
      state: 'SP',
      tenantId: ids.tenant,
      theme: ProfileTheme.SYSTEM,
      totalEnergyKwh: 86.42,
    },
  });
  const adminPasswordHash = await argon2.hash(
    process.env.DEMO_ADMIN_PASSWORD ??
      process.env.DEMO_USER_PASSWORD ??
      'solis-admin-demo',
  );
  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        email: 'admin@solis.local',
        tenantId: ids.tenant,
      },
    },
    update: {
      isBlocked: false,
      name: 'Administrador Solis',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
    create: {
      email: 'admin@solis.local',
      id: ids.adminUser,
      name: 'Administrador Solis',
      passwordHash: adminPasswordHash,
      phone: '+5511000000000',
      role: UserRole.ADMIN,
      tenantId: ids.tenant,
    },
  });
  const adminMembership = await prisma.operatorMembership.upsert({
    where: { id: ids.adminMembership },
    update: {
      acceptedAt: new Date(),
      disabledAt: null,
      disabledReason: null,
      displayName: adminUser.name,
      email: adminUser.email,
      status: OperatorMembershipStatus.ACTIVE,
      userId: adminUser.id,
    },
    create: {
      acceptedAt: new Date(),
      displayName: adminUser.name,
      email: adminUser.email,
      id: ids.adminMembership,
      status: OperatorMembershipStatus.ACTIVE,
      tenantId: ids.tenant,
      userId: adminUser.id,
    },
  });
  await prisma.operatorRoleAssignment.upsert({
    where: {
      membershipId_role: {
        membershipId: adminMembership.id,
        role: OperatorRole.TENANT_ADMIN,
      },
    },
    update: { assignedByUserId: adminUser.id },
    create: {
      assignedByUserId: adminUser.id,
      membershipId: adminMembership.id,
      role: OperatorRole.TENANT_ADMIN,
    },
  });
  const demoAdminAccounts = [
    {
      email: 'operacoes@solis.local',
      membershipId: ids.demoOperatorMembership,
      name: 'Operações Solis',
      role: OperatorRole.STATION_OPERATOR,
      userId: ids.demoOperatorUser,
    },
    {
      email: 'financeiro@solis.local',
      membershipId: ids.demoFinanceMembership,
      name: 'Financeiro Solis',
      role: OperatorRole.FINANCE_ANALYST,
      userId: ids.demoFinanceUser,
    },
    {
      email: 'viewer@solis.local',
      membershipId: ids.demoViewerMembership,
      name: 'Consulta Solis',
      role: OperatorRole.VIEWER,
      userId: ids.demoViewerUser,
    },
  ] as const;
  for (const account of demoAdminAccounts) {
    const demoUser = await prisma.user.upsert({
      where: {
        tenantId_email: { email: account.email, tenantId: ids.tenant },
      },
      update: {
        isBlocked: false,
        name: account.name,
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
      },
      create: {
        email: account.email,
        id: account.userId,
        name: account.name,
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
        tenantId: ids.tenant,
      },
    });
    const membership = await prisma.operatorMembership.upsert({
      where: { id: account.membershipId },
      update: {
        acceptedAt: new Date(),
        disabledAt: null,
        disabledReason: null,
        displayName: account.name,
        email: account.email,
        status: OperatorMembershipStatus.ACTIVE,
        userId: demoUser.id,
      },
      create: {
        acceptedAt: new Date(),
        displayName: account.name,
        email: account.email,
        id: account.membershipId,
        status: OperatorMembershipStatus.ACTIVE,
        tenantId: ids.tenant,
        userId: demoUser.id,
      },
    });
    await prisma.operatorRoleAssignment.upsert({
      where: {
        membershipId_role: {
          membershipId: membership.id,
          role: account.role,
        },
      },
      update: { assignedByUserId: adminUser.id },
      create: {
        assignedByUserId: adminUser.id,
        membershipId: membership.id,
        role: account.role,
      },
    });
  }

  await prisma.auditLog.upsert({
    where: { id: ids.adminAudit },
    update: {
      outcome: AuditOutcome.SUCCESS,
      userId: adminUser.id,
    },
    create: {
      action: 'ADMIN_SEED_CREATED',
      actorType: 'SYSTEM',
      after: { membershipId: adminMembership.id, role: 'TENANT_ADMIN' },
      entityId: adminMembership.id,
      entityType: 'OperatorMembership',
      id: ids.adminAudit,
      outcome: AuditOutcome.SUCCESS,
      tenantId: ids.tenant,
      userId: adminUser.id,
    },
  });
  await prisma.vehicle.upsert({
    where: { id: ids.vehicle },
    update: {
      color: 'Azul solar',
      isDefault: true,
      maximumAcPowerKw: 11,
      maximumDcPowerKw: 150,
      nickname: 'Aurora da Marina',
      status: VehicleStatus.ACTIVE,
    },
    create: {
      averageConsumptionKwhPer100Km: 15.2,
      batteryCapacityKwh: 64,
      brand: 'Aurora',
      color: 'Azul solar',
      estimatedRangeKm: 430,
      id: ids.vehicle,
      isDefault: true,
      licensePlate: 'SOL1S25',
      maximumAcPowerKw: 11,
      maximumDcPowerKw: 150,
      model: 'E1 Touring',
      nickname: 'Aurora da Marina',
      status: VehicleStatus.ACTIVE,
      supportedPlugTypes: [PlugType.CCS2, PlugType.TYPE_2],
      trim: 'Long Range',
      userId: ids.user,
      vehicleType: VehicleType.BEV,
      year: 2025,
    },
  });

  const ocppAuthSecretHash = await argon2.hash(
    process.env.OCPP_DEMO_PASSWORD ?? 'solis-ocpp-demo',
  );
  for (const station of stations) {
    await seedStation(
      station,
      station.protocol === ChargerProtocol.OCPP16
        ? ocppAuthSecretHash
        : undefined,
    );
  }
  await prisma.tariff.upsert({
    where: { id: ids.demoDraftTariff },
    update: {
      activationFee: 1,
      archivedAt: null,
      currency: 'BRL',
      name: 'Tarifa administrativa em revisão',
      parkingFeeHour: 0,
      pricePerKwh: 1.75,
      publicationStatus: TariffPublicationStatus.DRAFT,
      publishedAt: null,
      validUntil: null,
    },
    create: {
      activationFee: 1,
      currency: 'BRL',
      id: ids.demoDraftTariff,
      name: 'Tarifa administrativa em revisão',
      operatorId: ids.operator,
      parkingFeeHour: 0,
      pricePerKwh: 1.75,
      publicationStatus: TariffPublicationStatus.DRAFT,
      publishedAt: null,
      stationId: ids.stationOne,
      validFrom: new Date('2026-08-01T00:00:00.000Z'),
    },
  });
  const seededTariffs = await prisma.tariff.findMany({
    where: {
      deletedAt: null,
      publicationStatus: TariffPublicationStatus.PUBLISHED,
      station: { tenantId: ids.tenant },
    },
  });
  for (const tariff of seededTariffs) {
    const snapshot = {
      currency: tariff.currency,
      name: tariff.name,
      pricePerKwh: tariff.pricePerKwh.toString(),
      validFrom: tariff.validFrom.toISOString(),
      validUntil: tariff.validUntil?.toISOString() ?? null,
    };
    await prisma.tariffVersion.upsert({
      where: {
        tariffId_versionNumber: { tariffId: tariff.id, versionNumber: 1 },
      },
      update: { snapshot, status: TariffPublicationStatus.PUBLISHED },
      create: {
        createdByUserId: adminUser.id,
        effectiveAt: tariff.validFrom,
        publishedAt: tariff.publishedAt ?? new Date(),
        snapshot,
        status: TariffPublicationStatus.PUBLISHED,
        tariffId: tariff.id,
        tenantId: ids.tenant,
        versionNumber: 1,
      },
    });
  }

  await prisma.paymentPolicyConfig.upsert({
    where: {
      tenantId_currency: { currency: 'BRL', tenantId: ids.tenant },
    },
    update: {
      lowBalanceWarningMinor: 2_000n,
      maximumSessionAmountMinor: 50_000n,
      maximumTopUpAmountMinor: 200_000n,
      minimumTopUpAmountMinor: 5_000n,
      minimumWalletBalanceMinor: 2_000n,
      preAuthorizationAmountMinor: 5_000n,
      version: { increment: 1 },
    },
    create: {
      currency: 'BRL',
      lowBalanceWarningMinor: 2_000n,
      maximumSessionAmountMinor: 50_000n,
      maximumTopUpAmountMinor: 200_000n,
      minimumTopUpAmountMinor: 5_000n,
      minimumWalletBalanceMinor: 2_000n,
      preAuthorizationAmountMinor: 5_000n,
      tenantId: ids.tenant,
    },
  });
  const demoWallet = await prisma.wallet.upsert({
    where: {
      tenantId_userId_currency: {
        currency: 'BRL',
        tenantId: ids.tenant,
        userId: ids.user,
      },
    },
    update: {
      availableBalanceMinor: 29_266n,
      reservedBalanceMinor: 0n,
      status: WalletStatus.ACTIVE,
      version: { increment: 1 },
    },
    create: {
      availableBalanceMinor: 29_266n,
      currency: 'BRL',
      id: ids.wallet,
      reservedBalanceMinor: 0n,
      status: WalletStatus.ACTIVE,
      tenantId: ids.tenant,
      userId: ids.user,
    },
  });

  const ledgerAccounts = [
    { accountType: LedgerAccountType.USER_WALLET_AVAILABLE, id: ids.walletAvailable, ownerId: demoWallet.id, ownerType: LedgerAccountOwnerType.USER },
    { accountType: LedgerAccountType.USER_WALLET_RESERVED, id: ids.walletReserved, ownerId: demoWallet.id, ownerType: LedgerAccountOwnerType.USER },
    { accountType: LedgerAccountType.PAYMENT_GATEWAY_CLEARING, id: ids.walletClearing, ownerId: ids.tenant, ownerType: LedgerAccountOwnerType.PLATFORM },
    { accountType: LedgerAccountType.OPERATOR_REVENUE, id: ids.walletRevenue, ownerId: ids.tenant, ownerType: LedgerAccountOwnerType.PLATFORM },
    { accountType: LedgerAccountType.REFUND_CLEARING, id: ids.walletRefund, ownerId: ids.tenant, ownerType: LedgerAccountOwnerType.PLATFORM },
  ] as const;
  const ledgerAccountIds = new Map<LedgerAccountType, string>();
  for (const account of ledgerAccounts) {
    const saved = await prisma.ledgerAccount.upsert({
      where: {
        tenantId_ownerType_ownerId_accountType_currency: {
          accountType: account.accountType,
          currency: 'BRL',
          ownerId: account.ownerId,
          ownerType: account.ownerType,
          tenantId: ids.tenant,
        },
      },
      update: { status: LedgerAccountStatus.ACTIVE },
      create: {
        ...account,
        currency: 'BRL',
        status: LedgerAccountStatus.ACTIVE,
        tenantId: ids.tenant,
      },
    });
    ledgerAccountIds.set(account.accountType, saved.id);
  }
  const ledgerAccountId = (type: LedgerAccountType): string => {
    const id = ledgerAccountIds.get(type);
    if (!id) throw new Error(`Conta de ledger ausente no seed: ${type}`);
    return id;
  };

  const demoStartedAt = new Date('2026-07-28T16:00:00.000Z');
  const demoCompletedAt = new Date('2026-07-28T16:24:00.000Z');
  await prisma.chargingSession.upsert({
    where: { id: ids.demoSession },
    update: {
      completedAt: demoCompletedAt,
      energyKwh: '6.172',
      estimatedCost: '12.34',
      meterStartWh: 100_000n,
      meterStopWh: 106_172n,
      startedAt: demoStartedAt,
      status: 'COMPLETED',
      stoppedAt: demoCompletedAt,
      totalAmount: '12.34',
    },
    create: {
      chargePointId: stations[0]!.chargePointId,
      completedAt: demoCompletedAt,
      connectorId: ids.connectorOne,
      energyKwh: '6.172',
      estimatedCost: '12.34',
      evseId: ids.evseOne,
      id: ids.demoSession,
      idempotencyKey: 'seed-financial-session',
      meterStartWh: 100_000n,
      meterStopWh: 106_172n,
      startedAt: demoStartedAt,
      stationId: ids.stationOne,
      status: 'COMPLETED',
      stoppedAt: demoCompletedAt,
      tariffId: '70707070-7070-4070-8070-707070707070',
      tariffSnapshot: {
        activationFee: 0,
        currency: 'BRL',
        initialBatteryPercent: 30,
        name: 'Tarifa demonstrativa congelada',
        parkingFeeHour: 0,
        pricePerKwh: 2,
      },
      totalAmount: '12.34',
      userId: ids.user,
      vehicleId: ids.vehicle,
    },
  });
  await prisma.remoteCommand.upsert({
    where: {
      tenantId_idempotencyKey: {
        idempotencyKey: 'seed-admin-remote-stop',
        tenantId: ids.tenant,
      },
    },
    update: {
      completedAt: demoCompletedAt,
      status: RemoteCommandStatus.ACCEPTED,
    },
    create: {
      chargePointId: stations[0]!.chargePointId,
      chargingSessionId: ids.demoSession,
      completedAt: demoCompletedAt,
      connectorId: ids.connectorOne,
      correlationId: 'seed-admin-command',
      createdByUserId: adminUser.id,
      id: ids.demoRemoteCommand,
      idempotencyKey: 'seed-admin-remote-stop',
      payload: { chargingSessionId: ids.demoSession },
      queuedAt: demoStartedAt,
      reason: 'Comando demonstrativo auditado',
      requestHash: 'seed-admin-remote-stop',
      result: { status: 'Accepted' },
      sentAt: demoStartedAt,
      stationId: ids.stationOne,
      status: RemoteCommandStatus.ACCEPTED,
      tenantId: ids.tenant,
      timeoutAt: demoCompletedAt,
      type: RemoteCommandType.REMOTE_STOP,
    },
  });
  await prisma.paymentMethod.upsert({
    where: { id: ids.paymentMethod },
    update: {
      isDefault: true,
      status: PaymentMethodStatus.ACTIVE,
    },
    create: {
      brand: 'Solis Test',
      expirationMonth: 12,
      expirationYear: 2099,
      id: ids.paymentMethod,
      isDefault: true,
      lastFour: '4242',
      provider: 'solis-mock',
      providerToken: 'mock_seed_token_not_a_real_card',
      status: PaymentMethodStatus.ACTIVE,
      tenantId: ids.tenant,
      type: PaymentMethodType.CARD,
      userId: ids.user,
    },
  });
  await prisma.autoRechargeRule.upsert({
    where: {
      tenantId_userId_currency: {
        currency: 'BRL',
        tenantId: ids.tenant,
        userId: ids.user,
      },
    },
    update: {
      enabled: false,
      minimumBalanceMinor: 5_000n,
      paymentMethodId: ids.paymentMethod,
      rechargeAmountMinor: 10_000n,
      version: { increment: 1 },
    },
    create: {
      currency: 'BRL',
      enabled: false,
      id: ids.autoRecharge,
      minimumBalanceMinor: 5_000n,
      paymentMethodId: ids.paymentMethod,
      rechargeAmountMinor: 10_000n,
      tenantId: ids.tenant,
      userId: ids.user,
    },
  });

  const paymentIntents: Prisma.PaymentIntentUncheckedCreateInput[] = [
    {
      amountMinor: 30_000n,
      authorizedAmountMinor: 30_000n,
      capturedAmountMinor: 30_000n,
      currency: 'BRL',
      id: ids.topUpPayment,
      idempotencyKey: 'seed-top-up-completed',
      provider: 'solis-mock',
      providerReference: 'mock_seed_topup_completed',
      requestHash: 'seed-top-up-completed',
      status: PaymentIntentStatus.CAPTURED,
      tenantId: ids.tenant,
      type: PaymentIntentType.WALLET_TOP_UP,
      userId: ids.user,
    },
    {
      amountMinor: 5_000n,
      authorizedAmountMinor: 5_000n,
      capturedAmountMinor: 1_234n,
      chargingSessionId: ids.demoSession,
      currency: 'BRL',
      id: ids.sessionPayment,
      idempotencyKey: 'seed-session-payment',
      provider: 'solis-wallet',
      providerReference: 'wallet_seed_session',
      requestHash: 'seed-session-payment',
      status: PaymentIntentStatus.CAPTURED,
      tenantId: ids.tenant,
      type: PaymentIntentType.CHARGING_AUTHORIZATION,
      userId: ids.user,
    },
    {
      amountMinor: 10_000n,
      currency: 'BRL',
      expiresAt: new Date('2099-12-31T23:59:59.000Z'),
      id: ids.pendingPayment,
      idempotencyKey: 'seed-pix-pending',
      provider: 'solis-mock',
      providerReference: 'mock_seed_pix_pending',
      requestHash: 'seed-pix-pending',
      status: PaymentIntentStatus.PENDING,
      tenantId: ids.tenant,
      type: PaymentIntentType.WALLET_TOP_UP,
      userId: ids.user,
    },
    {
      amountMinor: 5_000n,
      currency: 'BRL',
      id: ids.failedPayment,
      idempotencyKey: 'seed-payment-failed',
      provider: 'solis-mock',
      providerReference: 'mock_seed_payment_failed',
      requestHash: 'seed-payment-failed',
      status: PaymentIntentStatus.FAILED,
      tenantId: ids.tenant,
      type: PaymentIntentType.WALLET_TOP_UP,
      userId: ids.user,
    },
    {
      amountMinor: 500n,
      authorizedAmountMinor: 500n,
      capturedAmountMinor: 500n,
      currency: 'BRL',
      id: ids.refundedPayment,
      idempotencyKey: 'seed-payment-refunded',
      provider: 'solis-mock',
      providerReference: 'mock_seed_payment_refunded',
      refundedAmountMinor: 500n,
      requestHash: 'seed-payment-refunded',
      status: PaymentIntentStatus.REFUNDED,
      tenantId: ids.tenant,
      type: PaymentIntentType.REFUND,
      userId: ids.user,
    },
  ];
  for (const payment of paymentIntents) {
    await prisma.paymentIntent.upsert({
      where: { id: payment.id },
      update: {
        authorizedAmountMinor: payment.authorizedAmountMinor,
        capturedAmountMinor: payment.capturedAmountMinor,
        expiresAt: payment.expiresAt,
        refundedAmountMinor: payment.refundedAmountMinor,
        status: payment.status,
      },
      create: payment,
    });
  }
  await prisma.paymentReconciliation.upsert({
    where: { id: ids.demoReconciliation },
    update: {
      checkedAt: demoCompletedAt,
      localAmountMinor: 1_234n,
      localStatus: PaymentIntentStatus.CAPTURED,
      providerAmountMinor: 1_234n,
      providerStatus: PaymentIntentStatus.CAPTURED,
      status: PaymentReconciliationStatus.MATCHED,
    },
    create: {
      checkedAt: demoCompletedAt,
      details: { source: 'deterministic-seed' },
      id: ids.demoReconciliation,
      localAmountMinor: 1_234n,
      localStatus: PaymentIntentStatus.CAPTURED,
      paymentIntentId: ids.sessionPayment,
      providerAmountMinor: 1_234n,
      providerStatus: PaymentIntentStatus.CAPTURED,
      status: PaymentReconciliationStatus.MATCHED,
      tenantId: ids.tenant,
    },
  });
  await prisma.walletReservation.upsert({
    where: { chargingSessionId: ids.demoSession },
    update: {
      amountMinor: 5_000n,
      capturedMinor: 1_234n,
      completedAt: demoCompletedAt,
      releasedMinor: 3_766n,
      status: WalletReservationStatus.CAPTURED,
      version: { increment: 1 },
    },
    create: {
      amountMinor: 5_000n,
      capturedMinor: 1_234n,
      chargingSessionId: ids.demoSession,
      completedAt: demoCompletedAt,
      currency: 'BRL',
      idempotencyKey: 'seed-session-reservation',
      paymentIntentId: ids.sessionPayment,
      releasedMinor: 3_766n,
      requestHash: 'seed-session-reservation',
      status: WalletReservationStatus.CAPTURED,
      walletId: demoWallet.id,
    },
  });
  await prisma.receipt.upsert({
    where: { chargingSessionId: ids.demoSession },
    update: {
      amountMinor: 1_234n,
      status: ReceiptStatus.ISSUED,
    },
    create: {
      amountMinor: 1_234n,
      chargingSessionId: ids.demoSession,
      currency: 'BRL',
      id: ids.receipt,
      issuedAt: demoCompletedAt,
      paymentIntentId: ids.sessionPayment,
      receiptNumber: 'SOLIS-2026-SEED000000000001',
      snapshot: {
        connector: 'SOLIS-001-A',
        durationSeconds: 1440,
        energyKwh: '6.172',
        station: 'Solis Centro',
        vehicle: 'Aurora E1 Touring',
      },
      status: ReceiptStatus.ISSUED,
      tenantId: ids.tenant,
      userId: ids.user,
    },
  });
  await prisma.refund.upsert({
    where: {
      paymentIntentId_idempotencyKey: {
        idempotencyKey: 'seed-refund-completed',
        paymentIntentId: ids.refundedPayment,
      },
    },
    update: {
      completedAt: demoCompletedAt,
      status: RefundStatus.COMPLETED,
    },
    create: {
      amountMinor: 500n,
      completedAt: demoCompletedAt,
      currency: 'BRL',
      id: ids.refund,
      idempotencyKey: 'seed-refund-completed',
      paymentIntentId: ids.refundedPayment,
      providerReference: 'mock_seed_refund_completed',
      reason: 'Estorno demonstrativo',
      requestHash: 'seed-refund-completed',
      status: RefundStatus.COMPLETED,
    },
  });

  await seedLedgerTransaction({
    entries: [
      { accountId: ledgerAccountId(LedgerAccountType.PAYMENT_GATEWAY_CLEARING), amountMinor: 30_000n, direction: LedgerDirection.DEBIT },
      { accountId: ledgerAccountId(LedgerAccountType.USER_WALLET_AVAILABLE), amountMinor: 30_000n, direction: LedgerDirection.CREDIT },
    ],
    id: 'b1000000-0000-4000-8000-000000000001',
    idempotencyKey: 'seed-ledger-top-up',
    paymentIntentId: ids.topUpPayment,
    type: LedgerTransactionType.TOP_UP,
  });
  await seedLedgerTransaction({
    chargingSessionId: ids.demoSession,
    entries: [
      { accountId: ledgerAccountId(LedgerAccountType.USER_WALLET_AVAILABLE), amountMinor: 5_000n, direction: LedgerDirection.DEBIT },
      { accountId: ledgerAccountId(LedgerAccountType.USER_WALLET_RESERVED), amountMinor: 5_000n, direction: LedgerDirection.CREDIT },
    ],
    id: 'b1000000-0000-4000-8000-000000000002',
    idempotencyKey: 'seed-ledger-authorization',
    paymentIntentId: ids.sessionPayment,
    type: LedgerTransactionType.AUTHORIZATION,
  });
  await seedLedgerTransaction({
    chargingSessionId: ids.demoSession,
    entries: [
      { accountId: ledgerAccountId(LedgerAccountType.USER_WALLET_RESERVED), amountMinor: 1_234n, direction: LedgerDirection.DEBIT },
      { accountId: ledgerAccountId(LedgerAccountType.OPERATOR_REVENUE), amountMinor: 1_234n, direction: LedgerDirection.CREDIT },
    ],
    id: 'b1000000-0000-4000-8000-000000000003',
    idempotencyKey: 'seed-ledger-capture',
    paymentIntentId: ids.sessionPayment,
    type: LedgerTransactionType.CAPTURE,
  });
  await seedLedgerTransaction({
    chargingSessionId: ids.demoSession,
    entries: [
      { accountId: ledgerAccountId(LedgerAccountType.USER_WALLET_RESERVED), amountMinor: 3_766n, direction: LedgerDirection.DEBIT },
      { accountId: ledgerAccountId(LedgerAccountType.USER_WALLET_AVAILABLE), amountMinor: 3_766n, direction: LedgerDirection.CREDIT },
    ],
    id: 'b1000000-0000-4000-8000-000000000004',
    idempotencyKey: 'seed-ledger-release',
    paymentIntentId: ids.sessionPayment,
    type: LedgerTransactionType.RELEASE,
  });
  await seedLedgerTransaction({
    entries: [
      { accountId: ledgerAccountId(LedgerAccountType.REFUND_CLEARING), amountMinor: 500n, direction: LedgerDirection.DEBIT },
      { accountId: ledgerAccountId(LedgerAccountType.USER_WALLET_AVAILABLE), amountMinor: 500n, direction: LedgerDirection.CREDIT },
    ],
    id: 'b1000000-0000-4000-8000-000000000005',
    idempotencyKey: 'seed-ledger-refund',
    paymentIntentId: ids.refundedPayment,
    type: LedgerTransactionType.REFUND,
  });

  await prisma.meterValue.upsert({
    where: {
      chargingSessionId_sampledAt: {
        chargingSessionId: ids.demoSession,
        sampledAt: demoCompletedAt,
      },
    },
    update: { energyKwh: '6.172', meterWh: 106_172n, powerKw: 0 },
    create: {
      chargingSessionId: ids.demoSession,
      energyKwh: '6.172',
      meterWh: 106_172n,
      powerKw: 0,
      sampledAt: demoCompletedAt,
    },
  });
  console.info('Seed Solis concluído.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
