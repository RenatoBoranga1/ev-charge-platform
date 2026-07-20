import * as argon2 from 'argon2';

import {
  ConnectorStatus,
  CurrentType,
  PlugType,
  Prisma,
  PrismaClient,
  StationStatus,
  VehicleType,
} from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
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
    openingHours: 'Aberta 24 horas',
    plugType: PlugType.CCS2,
    pricePerKwh: 2.05,
    rating: 4.3,
    state: 'SP',
    status: StationStatus.PARTIAL,
  },
];

async function seedStation(input: StationSeed): Promise<void> {
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
    update: { status: input.status },
    create: {
      externalCode: input.externalCode,
      id: input.chargePointId,
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
    update: { passwordHash },
    create: {
      avoidedCo2Kg: 49.26,
      email: 'marina.souza@example.com',
      estimatedSavings: 214.8,
      id: ids.user,
      name: 'Marina Souza',
      passwordHash,
      phone: '+5511999999999',
      tenantId: ids.tenant,
      totalEnergyKwh: 86.42,
    },
  });
  await prisma.vehicle.upsert({
    where: { id: ids.vehicle },
    update: { isDefault: true },
    create: {
      averageConsumptionKwhPer100Km: 15.2,
      batteryCapacityKwh: 64,
      brand: 'Aurora',
      estimatedRangeKm: 430,
      id: ids.vehicle,
      isDefault: true,
      licensePlate: 'SOL1S25',
      model: 'E1 Touring',
      supportedPlugTypes: [PlugType.CCS2, PlugType.TYPE_2],
      trim: 'Long Range',
      userId: ids.user,
      vehicleType: VehicleType.BEV,
      year: 2025,
    },
  });

  for (const station of stations) await seedStation(station);
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
