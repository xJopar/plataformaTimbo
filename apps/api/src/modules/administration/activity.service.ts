import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ActivityExportLimitError,
  MAX_ACTIVITY_EXPORT_ROWS,
  type ActivityFilterOptions,
  type ActivityItem,
  type ActivityList,
  type ActivityQuery,
  type ActivitySource,
  type ActivityStatistics,
} from './activity.contracts';

interface ActivityRow {
  id: string;
  source: ActivitySource;
  actor: string;
  appKey: string;
  eventName: string;
  outcome: string;
  visitId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  occurredAt: Date;
}

interface CountRow {
  total: number | bigint | string;
}

interface StatisticsRow {
  eventsToday: number | bigint | string;
  activePeopleToday: number | bigint | string;
  mostFrequentApp: string | null;
  mostFrequentEvent: string | null;
}

interface OptionsRow {
  value: string;
}

interface TopValueRow {
  value: string;
}

@Injectable()
export class ActivityService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async list(query: ActivityQuery): Promise<ActivityList> {
    const activityRowsQuery = this.createFilteredRowsQuery(query);
    const [rows, countRows] = await Promise.all([
      this.prismaService.$queryRaw<ActivityRow[]>(Prisma.sql`
        SELECT id, source, actor, app_key AS "appKey", event_name AS "eventName", outcome,
          visit_id AS "visitId",
          target_type AS "targetType", target_id AS "targetId", metadata, occurred_at AS "occurredAt"
        FROM (${activityRowsQuery}) AS activity_rows
        ORDER BY occurred_at DESC, id DESC
        LIMIT ${query.limit} OFFSET ${query.offset}
      `),
      this.prismaService.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*) AS total FROM (${activityRowsQuery}) AS activity_rows
      `),
    ]);

    return {
      items: rows.map(toActivityItem),
      total: toSafeNumber(countRows[0]?.total),
      limit: query.limit,
      offset: query.offset,
    };
  }

  public async getStatistics(query: ActivityQuery): Promise<ActivityStatistics> {
    const activityRowsQuery = this.createFilteredRowsQuery(query);
    const paraguayTodayStart = getParaguayTodayStart(query.windowEnd);
    const [summaryRows, appRows, eventRows] = await Promise.all([
      this.prismaService.$queryRaw<StatisticsRow[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE occurred_at >= ${paraguayTodayStart}) AS "eventsToday",
        COUNT(DISTINCT actor_user_id) FILTER (WHERE occurred_at >= ${paraguayTodayStart}) AS "activePeopleToday"
      FROM (${activityRowsQuery}) AS activity_rows
    `),
      this.prismaService.$queryRaw<TopValueRow[]>(Prisma.sql`
        SELECT app_key AS value FROM (${activityRowsQuery}) AS activity_rows
        GROUP BY app_key ORDER BY COUNT(*) DESC, app_key ASC LIMIT 1
      `),
      this.prismaService.$queryRaw<TopValueRow[]>(Prisma.sql`
        SELECT event_name AS value FROM (${activityRowsQuery}) AS activity_rows
        GROUP BY event_name ORDER BY COUNT(*) DESC, event_name ASC LIMIT 1
      `),
    ]);
    const row = summaryRows[0];
    return {
      eventsToday: toSafeNumber(row?.eventsToday),
      activePeopleToday: toSafeNumber(row?.activePeopleToday),
      mostFrequentApp: appRows[0]?.value ?? null,
      mostFrequentEvent: eventRows[0]?.value ?? null,
    };
  }

  public async getFilterOptions(query: ActivityQuery): Promise<ActivityFilterOptions> {
    const activityRowsQuery = this.createFilteredRowsQuery(query);
    const [actors, apps, events, targets] = await Promise.all([
      this.prismaService.$queryRaw<OptionsRow[]>(
        Prisma.sql`SELECT DISTINCT actor AS value FROM (${activityRowsQuery}) AS activity_rows WHERE actor <> '' ORDER BY actor LIMIT 100`,
      ),
      this.prismaService.$queryRaw<OptionsRow[]>(
        Prisma.sql`SELECT DISTINCT app_key AS value FROM (${activityRowsQuery}) AS activity_rows ORDER BY app_key LIMIT 100`,
      ),
      this.prismaService.$queryRaw<OptionsRow[]>(
        Prisma.sql`SELECT DISTINCT event_name AS value FROM (${activityRowsQuery}) AS activity_rows ORDER BY event_name LIMIT 100`,
      ),
      this.prismaService.$queryRaw<OptionsRow[]>(
        Prisma.sql`SELECT DISTINCT target_type || ':' || target_id AS value FROM (${activityRowsQuery}) AS activity_rows WHERE target_type IS NOT NULL AND target_id IS NOT NULL ORDER BY target_type || ':' || target_id LIMIT 100`,
      ),
    ]);
    return {
      actors: actors.map((row) => row.value),
      sources: ['AUDIT', 'USAGE'],
      apps: apps.map((row) => row.value),
      events: events.map((row) => row.value),
      targets: targets.map((row) => row.value),
    };
  }

  public async exportCsv(query: ActivityQuery): Promise<string> {
    const queryWithoutPagination = { ...query, limit: MAX_ACTIVITY_EXPORT_ROWS, offset: 0 };
    const activityRowsQuery = this.createFilteredRowsQuery(queryWithoutPagination);
    const countRows = await this.prismaService.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*) AS total FROM (${activityRowsQuery}) AS activity_rows
    `);
    const total = toSafeNumber(countRows[0]?.total);
    if (total > MAX_ACTIVITY_EXPORT_ROWS) {
      throw new ActivityExportLimitError(total);
    }

    const rows = await this.prismaService.$queryRaw<ActivityRow[]>(Prisma.sql`
        SELECT id, source, actor, app_key AS "appKey", event_name AS "eventName", outcome,
          visit_id AS "visitId",
        target_type AS "targetType", target_id AS "targetId", metadata, occurred_at AS "occurredAt"
      FROM (${activityRowsQuery}) AS activity_rows
      ORDER BY occurred_at DESC, id DESC
      LIMIT ${MAX_ACTIVITY_EXPORT_ROWS}
    `);
    return createActivityCsv(rows.map(toActivityItem));
  }

  private createFilteredRowsQuery(query: ActivityQuery): Prisma.Sql {
    const filters: Prisma.Sql[] = [];
    filters.push(
      Prisma.sql`occurred_at >= ${query.windowStart} AND occurred_at < ${query.windowEnd}`,
    );
    if (query.actor !== undefined) filters.push(Prisma.sql`actor = ${query.actor}`);
    if (query.source !== undefined) filters.push(Prisma.sql`source = ${query.source}`);
    if (query.appKey !== undefined) filters.push(Prisma.sql`app_key = ${query.appKey}`);
    if (query.eventName !== undefined) filters.push(Prisma.sql`event_name = ${query.eventName}`);
    if (query.target !== undefined) {
      filters.push(Prisma.sql`target_type || ':' || target_id = ${query.target}`);
    }
    const whereClause =
      filters.length === 0 ? Prisma.empty : Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;

    return Prisma.sql`
      SELECT * FROM (
        SELECT
          audit_events.id, 'AUDIT'::text AS source, audit_events.actor_user_id,
          audit_events.app_key, audit_events.event_name, audit_events.outcome::text, audit_events.target_type,
          audit_events.target_id, NULL::uuid AS visit_id, audit_events.metadata, audit_events.occurred_at,
          CASE
            WHEN audit_events.actor_user_id IS NOT NULL THEN COALESCE(NULLIF(users.display_name, ''), 'Usuario')
            WHEN audit_events.system_actor_key IS NOT NULL THEN audit_events.system_actor_key
            WHEN audit_events.actor_type = 'ANONYMOUS' THEN 'Anónimo'
            ELSE 'Sistema'
          END AS actor
        FROM audit_events
        LEFT JOIN users ON users.id = audit_events.actor_user_id
        UNION ALL
        SELECT
          usage_events.id, 'USAGE'::text AS source, usage_events.actor_user_id,
          usage_events.app_key, usage_events.event_name, 'SUCCESS'::text, usage_events.target_type,
          usage_events.target_id, usage_events.visit_id, usage_events.metadata, usage_events.occurred_at,
          COALESCE(NULLIF(users.display_name, ''), 'Usuario') AS actor
        FROM usage_events
        INNER JOIN users ON users.id = usage_events.actor_user_id
      ) AS activity_rows ${whereClause}
    `;
  }
}

function toActivityItem(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    source: row.source,
    actor: row.actor,
    appKey: row.appKey,
    eventName: row.eventName,
    outcome: row.outcome,
    visitId: row.visitId,
    targetType: row.targetType,
    targetId: row.targetId,
    target:
      row.targetType === null || row.targetId === null ? null : `${row.targetType}:${row.targetId}`,
    metadata: redactMetadata(row.source, row.eventName, row.metadata),
    occurredAt: row.occurredAt.toISOString(),
  };
}

function redactMetadata(
  source: ActivitySource,
  eventName: string,
  metadata: unknown,
): Record<string, string> {
  if (
    source === 'AUDIT' &&
    eventName === 'security.login_denied' &&
    isRecord(metadata) &&
    typeof metadata.reasonCode === 'string' &&
    [
      'USER_NOT_AUTHORIZED',
      'USER_INACTIVE',
      'GOOGLE_IDENTITY_MISMATCH',
      'GOOGLE_IDENTITY_INVALID',
    ].includes(metadata.reasonCode)
  ) {
    return { reasonCode: metadata.reasonCode };
  }
  if (
    source === 'USAGE' &&
    ['lista-precios.model_viewed', 'lista-precios.consultation_started'].includes(eventName) &&
    isRecord(metadata) &&
    isBoundedActivityText(metadata.brand, 80) &&
    isBoundedActivityText(metadata.model, 120)
  ) {
    return { brand: metadata.brand, model: metadata.model };
  }
  return {};
}

function createActivityCsv(items: ActivityItem[]): string {
  const header = [
    'Fecha',
    'Fuente',
    'Actor',
    'Aplicación',
    'Evento',
    'Resultado',
    'Visita',
    'Tipo de objetivo',
    'Id objetivo',
    'Marca',
    'Modelo',
    'Detalle seguro',
  ];
  const body = items.map((item) => [
    item.occurredAt,
    item.source,
    item.actor,
    item.appKey,
    item.eventName,
    item.outcome,
    item.visitId ?? '',
    item.targetType ?? '',
    item.targetId ?? '',
    item.metadata.brand ?? '',
    item.metadata.model ?? '',
    Object.entries(item.metadata)
      .filter(([key]) => key !== 'brand' && key !== 'model')
      .map(([key, value]) => `${key}: ${value}`)
      .join('; '),
  ]);
  return `\uFEFF${[header, ...body].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function escapeCsvCell(value: string): string {
  const protectedValue = startsWithUnsafeCsvFormula(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

function startsWithUnsafeCsvFormula(value: string): boolean {
  let index = 0;
  while (index < value.length) {
    const character = value[index];
    if (character === undefined || (!/\s/u.test(character) && character.charCodeAt(0) > 31)) break;
    index += 1;
  }
  const firstContentCharacter = value[index];
  return firstContentCharacter !== undefined && '=+-@'.includes(firstContentCharacter);
}

function getParaguayTodayStart(asOf: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(asOf);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const calendarDate = `${value('year')}-${value('month')}-${value('day')}`;
  const provisional = new Date(`${calendarDate}T00:00:00.000Z`);
  const offsetPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Asuncion',
    timeZoneName: 'longOffset',
  })
    .formatToParts(provisional)
    .find((part) => part.type === 'timeZoneName')?.value;
  const offsetMatch = /^GMT([+-])(\d{2}):(\d{2})$/u.exec(offsetPart ?? '');
  if (offsetMatch === null) throw new Error('No se pudo resolver la zona horaria de Paraguay.');
  const offsetMinutes =
    (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) * (offsetMatch[1] === '+' ? 1 : -1);
  return new Date(provisional.getTime() - offsetMinutes * 60_000);
}

function toSafeNumber(value: number | bigint | string | undefined): number {
  const parsed = typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error('La base devolvió un conteo inválido.');
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedActivityText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
