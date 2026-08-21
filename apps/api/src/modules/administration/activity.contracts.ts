export const MAX_ACTIVITY_EXPORT_ROWS = 5000;
export const MAX_ACTIVITY_RANGE_DAYS = 366;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_FILTER_VALUE_LENGTH = 160;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export type ActivitySource = 'AUDIT' | 'USAGE';
export type ActivityDatePreset = 'today' | 'week' | 'month';

export interface ActivityQuery {
  datePreset: ActivityDatePreset;
  dateFrom?: string;
  dateTo?: string;
  asOf?: string;
  windowStart: Date;
  windowEnd: Date;
  actor?: string;
  source?: ActivitySource;
  appKey?: string;
  eventName?: string;
  target?: string;
  limit: number;
  offset: number;
}

export interface ActivityItem {
  id: string;
  source: ActivitySource;
  actor: string;
  appKey: string;
  eventName: string;
  outcome: string;
  target: string | null;
  metadata: Record<string, string>;
  occurredAt: string;
}

export interface ActivityList {
  items: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ActivityStatistics {
  eventsToday: number;
  activePeopleToday: number;
  mostFrequentApp: string | null;
  mostFrequentEvent: string | null;
}

export interface ActivityFilterOptions {
  actors: string[];
  sources: ActivitySource[];
  apps: string[];
  events: string[];
  targets: string[];
}

export class ActivityQueryValidationError extends Error {
  public constructor(
    public readonly code:
      'ACTIVITY_DATE_RANGE_INVALID' | 'ACTIVITY_DATE_RANGE_EXCEEDED' | 'ACTIVITY_QUERY_INVALID',
    message: string,
  ) {
    super(message);
  }
}

export class ActivityExportLimitError extends Error {
  public constructor(public readonly total: number) {
    super(`La exportación supera el límite de ${MAX_ACTIVITY_EXPORT_ROWS.toString()} registros.`);
  }
}

export function parseActivityQuery(input: Record<string, unknown>): ActivityQuery {
  const datePreset = readOptionalEnum(input.datePreset, 'datePreset', [
    'today',
    'week',
    'month',
  ] as const);
  const dateFrom = readOptionalDate(input.dateFrom, 'dateFrom');
  const dateTo = readOptionalDate(input.dateTo, 'dateTo');
  const asOf = readOptionalInstant(input.asOf, 'asOf');
  if ((dateFrom === undefined) !== (dateTo === undefined)) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_DATE_RANGE_INVALID',
      'El rango personalizado requiere fecha desde y fecha hasta.',
    );
  }
  if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_DATE_RANGE_INVALID',
      'La fecha desde no puede ser posterior a la fecha hasta.',
    );
  }
  if (datePreset !== undefined && dateFrom !== undefined) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_DATE_RANGE_INVALID',
      'Usá un período rápido o un rango de fechas, no ambos.',
    );
  }
  const window = resolveActivityWindow({
    datePreset: datePreset ?? 'month',
    dateFrom,
    dateTo,
    asOf: asOf === undefined ? new Date() : new Date(asOf),
  });
  return {
    datePreset: datePreset ?? 'month',
    dateFrom,
    dateTo,
    asOf,
    windowStart: window.start,
    windowEnd: window.end,
    actor: readOptionalFilter(input.actor, 'actor'),
    source: readOptionalEnum(input.source, 'source', ['AUDIT', 'USAGE'] as const),
    appKey: readOptionalFilter(input.appKey, 'appKey'),
    eventName: readOptionalFilter(input.eventName, 'eventName'),
    target: readOptionalFilter(input.target, 'target'),
    limit: readPaginationValue(input.limit, 'limit', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    offset: readPaginationValue(input.offset, 'offset', 0, Number.MAX_SAFE_INTEGER),
  };
}

function readOptionalFilter(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > MAX_FILTER_VALUE_LENGTH) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_QUERY_INVALID',
      `El filtro ${name} no es válido.`,
    );
  }
  return value;
}

function readOptionalDate(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : undefined;
  if (
    typeof value !== 'string' ||
    !DATE_PATTERN.test(value) ||
    date === undefined ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_DATE_RANGE_INVALID',
      `La fecha ${name} no es válida.`,
    );
  }
  return value;
}

function readOptionalInstant(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_QUERY_INVALID',
      `El valor ${name} no es válido.`,
    );
  }
  return value;
}

function readOptionalEnum<T extends string>(
  value: unknown,
  name: string,
  values: readonly T[],
): T | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_QUERY_INVALID',
      `El filtro ${name} no es válido.`,
    );
  }
  return value as T;
}

function readPaginationValue(
  value: unknown,
  name: string,
  defaultValue: number,
  maxValue: number,
): number {
  if (value === undefined || value === '') return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_QUERY_INVALID',
      `El valor ${name} debe ser un entero no negativo.`,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maxValue) {
    throw new ActivityQueryValidationError(
      'ACTIVITY_QUERY_INVALID',
      `El valor ${name} supera el máximo permitido.`,
    );
  }
  return parsed;
}

function resolveActivityWindow(input: {
  datePreset: ActivityDatePreset;
  dateFrom?: string;
  dateTo?: string;
  asOf: Date;
}): { start: Date; end: Date } {
  const now = input.asOf;
  if (input.dateFrom !== undefined && input.dateTo !== undefined) {
    const start = dateAtParaguayStart(input.dateFrom);
    const end = dateAtParaguayStart(nextCalendarDate(input.dateTo));
    if (calendarDaysInclusive(input.dateFrom, input.dateTo) > MAX_ACTIVITY_RANGE_DAYS) {
      throw new ActivityQueryValidationError(
        'ACTIVITY_DATE_RANGE_EXCEEDED',
        `El rango de actividad no puede superar ${MAX_ACTIVITY_RANGE_DAYS.toString()} días.`,
      );
    }
    return { start, end };
  }

  const localToday = getParaguayCalendarDate(now);
  if (input.datePreset === 'today') return { start: dateAtParaguayStart(localToday), end: now };
  if (input.datePreset === 'week') {
    const localWeekday = new Date(`${localToday}T12:00:00.000Z`).getUTCDay();
    return {
      start: dateAtParaguayStart(addCalendarDays(localToday, -((localWeekday + 6) % 7))),
      end: now,
    };
  }
  return { start: dateAtParaguayStart(`${localToday.slice(0, 8)}01`), end: now };
}

function getParaguayCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dateAtParaguayStart(calendarDate: string): Date {
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

function nextCalendarDate(calendarDate: string): string {
  return addCalendarDays(calendarDate, 1);
}

function addCalendarDays(calendarDate: string, days: number): string {
  const date = new Date(`${calendarDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calendarDaysInclusive(start: string, end: string): number {
  return (
    Math.floor(
      (new Date(`${end}T12:00:00.000Z`).getTime() - new Date(`${start}T12:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1
  );
}
