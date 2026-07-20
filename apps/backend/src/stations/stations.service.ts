import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@solis/database';

import { PrismaService } from '../database/prisma.service';
import type { NearbyStationsDto } from './dto/nearby-stations.dto';

const stationInclude = {
  operator: true,
  tariffs: {
    where: { deletedAt: null },
    orderBy: { validFrom: 'desc' as const },
    take: 1,
  },
  chargePoints: {
    where: { deletedAt: null },
    include: {
      evses: {
        where: { deletedAt: null },
        include: {
          connectors: {
            where: { deletedAt: null },
            orderBy: { number: 'asc' as const },
          },
        },
      },
    },
  },
} satisfies Prisma.StationInclude;

type StationRecord = Prisma.StationGetPayload<{
  include: typeof stationInclude;
}>;

interface NearbyRow {
  distanceKm: number;
  id: string;
}

export interface ConnectorDto {
  code: string;
  currentType: string;
  id: string;
  maximumPowerKw: number;
  number: number;
  plugType: string;
  status: string;
}

export interface StationDto {
  address: string;
  availableConnectors: number;
  connectors: ConnectorDto[];
  distanceKm: number;
  hasParking: boolean;
  id: string;
  isOpen24Hours: boolean;
  latitude: number;
  longitude: number;
  maximumPowerKw: number;
  openingHours: string;
  operator: string;
  plugTypes: string[];
  pricePerKwh: number;
  rating: number;
  status: string;
  name: string;
  totalConnectors: number;
}

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  async nearby(query: NearbyStationsDto, tenantId: string): Promise<StationDto[]> {
    const rows = await this.prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      SELECT
        id,
        ST_Distance(
          location,
          ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography
        ) / 1000.0 AS "distanceKm"
      FROM stations
      WHERE tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
        AND location IS NOT NULL
        AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography,
          ${query.distanceKm * 1000}
        )
      ORDER BY "distanceKm"
    `);
    if (rows.length === 0) return [];

    const distanceById = new Map(
      rows.map((row) => [row.id, Number(row.distanceKm)]),
    );
    const stations = await this.prisma.station.findMany({
      where: {
        id: { in: rows.map((row) => row.id) },
        tenantId,
        deletedAt: null,
      },
      include: stationInclude,
    });

    return stations
      .map((station) =>
        this.toDto(station, distanceById.get(station.id) ?? 0),
      )
      .filter(
        (station) =>
          station.maximumPowerKw >= query.minimumPowerKw &&
          station.pricePerKwh <= query.maximumPricePerKwh,
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getById(id: string, tenantId: string): Promise<StationDto> {
    const station = await this.prisma.station.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: stationInclude,
    });
    if (!station) throw new NotFoundException('Estação não encontrada.');
    return this.toDto(station, 0);
  }

  async validateConnector(
    input: {
      chargePointId?: string;
      code?: string;
      connectorId?: string;
      evseId?: string;
      stationId?: string;
    },
    tenantId: string,
  ): Promise<{
    connector: ConnectorDto;
    estimatedPreauthorization: number;
    station: StationDto;
  }> {
    const connector = await this.prisma.connector.findFirst({
      where: {
        ...(input.connectorId ? { id: input.connectorId } : { code: input.code }),
        deletedAt: null,
        evse: {
          deletedAt: null,
          chargePoint: {
            deletedAt: null,
            station: { tenantId, deletedAt: null },
          },
        },
      },
      include: {
        evse: {
          include: {
            chargePoint: {
              include: {
                station: { include: stationInclude },
              },
            },
          },
        },
      },
    });

    if (!connector) throw new NotFoundException('Conector não encontrado.');
    if (connector.status !== 'AVAILABLE') {
      throw new UnprocessableEntityException('Conector indisponível.');
    }

    const chargePoint = connector.evse.chargePoint;
    if (
      (input.stationId && input.stationId !== chargePoint.stationId) ||
      (input.chargePointId && input.chargePointId !== chargePoint.id) ||
      (input.evseId && input.evseId !== connector.evseId)
    ) {
      throw new UnprocessableEntityException(
        'A hierarquia informada no QR Code não corresponde ao conector.',
      );
    }

    const station = this.toDto(chargePoint.station, 0);
    const connectorDto = station.connectors.find(
      (candidate) => candidate.id === connector.id,
    );
    if (!connectorDto) throw new NotFoundException('Conector não encontrado.');

    return {
      connector: connectorDto,
      estimatedPreauthorization: 80,
      station,
    };
  }

  private toDto(station: StationRecord, distanceKm: number): StationDto {
    const connectors = station.chargePoints.flatMap((chargePoint) =>
      chargePoint.evses.flatMap((evse) =>
        evse.connectors.map((connector) => ({
          code: connector.code,
          currentType: connector.currentType,
          id: connector.id,
          maximumPowerKw: Number(connector.maximumPowerKw),
          number: connector.number,
          plugType: connector.plugType,
          status: connector.status,
        })),
      ),
    );
    const maximumPowerKw =
      connectors.length > 0
        ? Math.max(...connectors.map((connector) => connector.maximumPowerKw))
        : 0;

    return {
      address: [station.address, station.city, station.state]
        .filter(Boolean)
        .join(' · '),
      availableConnectors: connectors.filter(
        (connector) => connector.status === 'AVAILABLE',
      ).length,
      connectors,
      distanceKm: Number(distanceKm.toFixed(2)),
      hasParking: station.hasParking,
      id: station.id,
      isOpen24Hours: station.isOpen24Hours,
      latitude: Number(station.latitude),
      longitude: Number(station.longitude),
      maximumPowerKw,
      name: station.name,
      openingHours: station.openingHours,
      operator: station.operator.name,
      plugTypes: [...new Set(connectors.map((connector) => connector.plugType))],
      pricePerKwh: Number(station.tariffs[0]?.pricePerKwh ?? 0),
      rating: Number(station.rating),
      status: station.status,
      totalConnectors: connectors.length,
    };
  }
}
