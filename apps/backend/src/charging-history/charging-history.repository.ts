import { Injectable } from '@nestjs/common';
import { Prisma } from '@solis/database';

import type { AuthUser } from '../auth/auth-user';
import type { ResolvedDateRange } from '../common/date-range';
import { PrismaService } from '../database/prisma.service';
import {
  ChargingHistoryQueryDto,
  ChargingHistorySort,
} from './dto/charging-history-query.dto';
import {
  type HistorySession,
  historySessionInclude,
} from './charging-history.presenter';
import {
  type HistoryCursor,
  HistoryCursorCodec,
} from './history-cursor';

interface HistoryIdRow {
  id: string;
  sortValue: Date | Prisma.Decimal | number | string;
}

export interface MeterPointRow {
  energyKwh: Prisma.Decimal;
  powerKw: Prisma.Decimal | null;
  sampledAt: Date;
}

function sortConfiguration(sort: ChargingHistorySort): {
  direction: 'ASC' | 'DESC';
  expression: Prisma.Sql;
  kind: 'number' | 'timestamp';
} {
  const startedAt = Prisma.sql`COALESCE(cs.started_at, cs.created_at)`;
  const duration = Prisma.sql`GREATEST(
    0,
    EXTRACT(EPOCH FROM (
      COALESCE(cs.completed_at, cs.stopped_at, cs.started_at, cs.created_at)
      - COALESCE(cs.started_at, cs.created_at)
    ))
  )`;
  switch (sort) {
    case ChargingHistorySort.OLDEST:
      return { direction: 'ASC', expression: startedAt, kind: 'timestamp' };
    case ChargingHistorySort.ENERGY_ASC:
      return {
        direction: 'ASC',
        expression: Prisma.sql`cs.energy_kwh`,
        kind: 'number',
      };
    case ChargingHistorySort.ENERGY_DESC:
      return {
        direction: 'DESC',
        expression: Prisma.sql`cs.energy_kwh`,
        kind: 'number',
      };
    case ChargingHistorySort.DURATION_ASC:
      return { direction: 'ASC', expression: duration, kind: 'number' };
    case ChargingHistorySort.DURATION_DESC:
      return { direction: 'DESC', expression: duration, kind: 'number' };
    case ChargingHistorySort.COST_ASC:
      return {
        direction: 'ASC',
        expression: Prisma.sql`cs.total_amount`,
        kind: 'number',
      };
    case ChargingHistorySort.COST_DESC:
      return {
        direction: 'DESC',
        expression: Prisma.sql`cs.total_amount`,
        kind: 'number',
      };
    case ChargingHistorySort.RECENT:
    default:
      return { direction: 'DESC', expression: startedAt, kind: 'timestamp' };
  }
}

@Injectable()
export class ChargingHistoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cursors: HistoryCursorCodec,
  ) {}

  async list(
    user: AuthUser,
    query: ChargingHistoryQueryDto,
    period: ResolvedDateRange,
  ): Promise<{
    endCursor: string | null;
    hasNextPage: boolean;
    items: HistorySession[];
  }> {
    const configuration = sortConfiguration(query.sort);
    const conditions: Prisma.Sql[] = [
      Prisma.sql`cs.deleted_at IS NULL`,
      Prisma.sql`cs.user_id = ${user.sub}::uuid`,
      Prisma.sql`s.tenant_id = ${user.tenantId}::uuid`,
      Prisma.sql`s.deleted_at IS NULL`,
      Prisma.sql`COALESCE(cs.started_at, cs.created_at) >= ${period.from}`,
      Prisma.sql`COALESCE(cs.started_at, cs.created_at) <= ${period.to}`,
    ];
    if (query.vehicleId) {
      conditions.push(Prisma.sql`cs.vehicle_id = ${query.vehicleId}::uuid`);
    }
    if (query.stationId) {
      conditions.push(Prisma.sql`cs.station_id = ${query.stationId}::uuid`);
    }
    if (query.status) {
      conditions.push(
        Prisma.sql`cs.status = ${query.status}::"ChargingSessionStatus"`,
      );
    }
    if (query.connectorType) {
      conditions.push(
        Prisma.sql`c.plug_type = ${query.connectorType}::"PlugType"`,
      );
    }
    if (query.withCost === 'true') {
      conditions.push(
        Prisma.sql`cs.status = 'COMPLETED'::"ChargingSessionStatus"`,
        Prisma.sql`cs.total_amount >= 0`,
      );
    }
    if (query.failuresOnly === 'true') {
      conditions.push(
        Prisma.sql`cs.status = 'FAILED'::"ChargingSessionStatus"`,
      );
    }
    if (query.completedOnly === 'true') {
      conditions.push(
        Prisma.sql`cs.status = 'COMPLETED'::"ChargingSessionStatus"`,
      );
    }
    if (query.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        Prisma.sql`(s.name ILIKE ${pattern} OR s.city ILIKE ${pattern})`,
      );
    }

    const decoded = query.cursor
      ? this.cursors.decode(query.cursor, query.sort)
      : null;
    const cursorCondition = decoded
      ? this.cursorCondition(configuration, decoded)
      : Prisma.empty;
    const direction = Prisma.raw(configuration.direction);
    const rows = await this.prisma.$queryRaw<HistoryIdRow[]>(Prisma.sql`
      SELECT
        cs.id::text AS "id",
        (${configuration.expression}) AS "sortValue"
      FROM charging_sessions cs
      INNER JOIN stations s ON s.id = cs.station_id
      INNER JOIN connectors c ON c.id = cs.connector_id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ${cursorCondition}
      ORDER BY ${configuration.expression} ${direction}, cs.id ${direction}
      LIMIT ${query.limit + 1}
    `);
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    if (pageRows.length === 0) {
      return { endCursor: null, hasNextPage: false, items: [] };
    }

    const sessions = await this.prisma.chargingSession.findMany({
      include: historySessionInclude,
      where: { id: { in: pageRows.map((row) => row.id) } },
    });
    const byId = new Map(sessions.map((session) => [session.id, session]));
    const items = pageRows.flatMap((row) => {
      const session = byId.get(row.id);
      return session ? [session] : [];
    });
    const last = pageRows.at(-1)!;
    return {
      endCursor: this.cursors.encode({
        id: last.id,
        sort: query.sort,
        value:
          last.sortValue instanceof Date
            ? last.sortValue.toISOString()
            : String(last.sortValue),
      }),
      hasNextPage,
      items,
    };
  }

  getOwnedSession(
    sessionId: string,
    user: AuthUser,
  ): Promise<HistorySession | null> {
    return this.prisma.chargingSession.findFirst({
      include: historySessionInclude,
      where: {
        deletedAt: null,
        id: sessionId,
        station: { deletedAt: null, tenantId: user.tenantId },
        userId: user.sub,
      },
    });
  }

  async getMeterPoints(
    sessionId: string,
    maxPoints: number,
  ): Promise<MeterPointRow[]> {
    return this.prisma.$queryRaw<MeterPointRow[]>(Prisma.sql`
      WITH ranked AS (
        SELECT
          sampled_at,
          energy_kwh,
          power_kw,
          FLOOR(
            (ROW_NUMBER() OVER (ORDER BY sampled_at) - 1) * ${maxPoints}
            / GREATEST(COUNT(*) OVER (), 1)
          ) AS bucket
        FROM meter_values
        WHERE charging_session_id = ${sessionId}::uuid
      )
      SELECT DISTINCT ON (bucket)
        sampled_at AS "sampledAt",
        energy_kwh AS "energyKwh",
        power_kw AS "powerKw"
      FROM ranked
      ORDER BY bucket, sampled_at
      LIMIT ${maxPoints}
    `);
  }

  private cursorCondition(
    configuration: ReturnType<typeof sortConfiguration>,
    cursor: HistoryCursor,
  ): Prisma.Sql {
    const operator = Prisma.raw(
      configuration.direction === 'DESC' ? '<' : '>',
    );
    const cursorValue =
      configuration.kind === 'timestamp'
        ? Prisma.sql`${new Date(cursor.value)}::timestamptz`
        : Prisma.sql`${Number(cursor.value)}::numeric`;
    return Prisma.sql`
      AND (
        ${configuration.expression} ${operator} ${cursorValue}
        OR (
          ${configuration.expression} = ${cursorValue}
          AND cs.id ${operator} ${cursor.id}::uuid
        )
      )
    `;
  }
}
