import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OperationalLoggerService } from '../observability/operational-logger.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  USAGE_EVENT_CATALOG,
  type UsageEventCatalog,
  type UsageEventCatalogEntry,
  type UsageEventMetadataFieldDefinition,
} from './usage-event-catalog';

const USAGE_EVENT_RETENTION_MONTHS = 12;
export const USAGE_EVENT_INPUT_METADATA_MAX_BYTES = 3072;
export const USAGE_EVENT_DATABASE_METADATA_MAX_BYTES = 4096;
const MAX_CATALOG_IDENTIFIER_LENGTH = 128;
const MAX_CATALOG_METADATA_FIELDS = 16;
const MAX_TARGET_ID_LENGTH = 256;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export interface UsageEventTarget {
  targetType: string;
  targetId: string;
}

export type UsageEventMetadata = Prisma.InputJsonObject;

export interface AppendUsageEventInput {
  eventId: string;
  actorUserId: string;
  eventName: string;
  visitId: string;
  target?: UsageEventTarget;
  metadata?: UsageEventMetadata;
}

export type AppendUsageEventResult =
  | { status: 'recorded'; id: string; eventId: string }
  | { status: 'duplicate'; eventId: string }
  | { status: 'failed'; eventId: string };

@Injectable()
export class UsageEventsService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly operationalLogger: OperationalLoggerService,
    @Inject(USAGE_EVENT_CATALOG) private readonly catalog: UsageEventCatalog,
  ) {
    validateCatalog(catalog);
  }

  public async append(input: AppendUsageEventInput): Promise<AppendUsageEventResult> {
    const definition = this.catalog[input.eventName];
    if (definition === undefined) {
      throw new Error('El evento de uso no está registrado en el catálogo.');
    }

    this.validateInput(input, definition);
    const requestId = this.requestContext.getRequestId() ?? randomUUID();
    const occurredAt = new Date();
    const expiresAt = addCalendarMonthsUtc(occurredAt, USAGE_EVENT_RETENTION_MONTHS);

    try {
      const event = await this.prismaService.usageEvent.create({
        data: {
          eventId: input.eventId,
          actorUserId: input.actorUserId,
          appKey: definition.appKey,
          eventName: input.eventName,
          visitId: input.visitId,
          targetType: input.target?.targetType ?? null,
          targetId: input.target?.targetId ?? null,
          requestId,
          metadata: input.metadata ?? {},
          occurredAt,
          expiresAt,
        },
      });

      return { status: 'recorded', id: event.id, eventId: input.eventId };
    } catch (error: unknown) {
      if (isEventIdUniqueViolation(error)) {
        return { status: 'duplicate', eventId: input.eventId };
      }

      this.logAppendFailure(error, {
        requestId,
        eventId: input.eventId,
        appKey: definition.appKey,
        eventName: input.eventName,
        actorUserId: input.actorUserId,
      });
      return { status: 'failed', eventId: input.eventId };
    }
  }

  private validateInput(input: AppendUsageEventInput, definition: UsageEventCatalogEntry): void {
    if (!isUuid(input.eventId) || !isUuid(input.actorUserId) || !isUuid(input.visitId)) {
      throw new Error('Los identificadores eventId, actorUserId y visitId deben ser UUID válidos.');
    }

    this.validateTarget(input.target, definition);
    this.validateMetadata(input.metadata, definition.metadataFields);
  }

  private validateTarget(
    target: UsageEventTarget | undefined,
    definition: UsageEventCatalogEntry,
  ): void {
    if (definition.target === undefined) {
      if (target !== undefined) {
        throw new Error('El catálogo del evento de uso no admite objetivo.');
      }
      return;
    }

    if (target === undefined) {
      if (definition.target.required) {
        throw new Error('El catálogo del evento de uso requiere un objetivo.');
      }
      return;
    }

    if (
      target.targetType !== definition.target.targetType ||
      !isNonEmptyStringWithin(target.targetId, definition.target.maxIdLength)
    ) {
      throw new Error('El objetivo no coincide con la definición del catálogo de uso.');
    }
  }

  private validateMetadata(
    metadata: UsageEventMetadata | undefined,
    definitions: readonly UsageEventMetadataFieldDefinition[],
  ): void {
    const value = metadata ?? {};
    if (!isPlainObject(value)) {
      throw new Error('La metadata del evento de uso debe ser un objeto simple.');
    }

    const definitionsByName = new Map(
      definitions.map((definition) => [definition.name, definition]),
    );
    for (const fieldName of Object.keys(value)) {
      const definition = definitionsByName.get(fieldName);
      if (definition === undefined) {
        throw new Error('La metadata contiene un campo no permitido por el catálogo de uso.');
      }
      this.validateMetadataValue(value[fieldName], definition);
    }

    for (const definition of definitions) {
      if (definition.required && !(definition.name in value)) {
        throw new Error('La metadata no contiene un campo requerido por el catálogo de uso.');
      }
    }

    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > USAGE_EVENT_INPUT_METADATA_MAX_BYTES) {
      throw new Error('La metadata del evento de uso supera el máximo de entrada de 3 KiB.');
    }
  }

  private validateMetadataValue(
    value: unknown,
    definition: UsageEventMetadataFieldDefinition,
  ): void {
    if (definition.type === 'string') {
      if (typeof value !== 'string' || value.length > definition.maxLength) {
        throw new Error('La metadata no coincide con los límites del catálogo de uso.');
      }
      if (definition.allowedValues !== undefined && !definition.allowedValues.includes(value)) {
        throw new Error(
          'La metadata no coincide con los valores permitidos por el catálogo de uso.',
        );
      }
      return;
    }

    if (definition.type === 'uuid' && !isUuid(value)) {
      throw new Error('La metadata requiere un UUID permitido por el catálogo de uso.');
    }
    if (definition.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error('La metadata requiere un número finito permitido por el catálogo de uso.');
    }
    if (definition.type === 'boolean' && typeof value !== 'boolean') {
      throw new Error('La metadata requiere un booleano permitido por el catálogo de uso.');
    }
  }

  private logAppendFailure(
    error: unknown,
    fields: Parameters<OperationalLoggerService['logUsageEventAppendFailed']>[1],
  ): void {
    try {
      this.operationalLogger.logUsageEventAppendFailed(error, fields);
    } catch {
      this.writeLoggerFailureFallback();
    }
  }

  private writeLoggerFailureFallback(): void {
    try {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'api',
          event: 'api.usage-event.append_failed_logger_failed',
          operation: 'usage-event.append',
        }),
      );
    } catch {
      // Si stderr falla, no existe otro canal seguro y no se intenta registrar recursivamente.
    }
  }
}

export function addCalendarMonthsUtc(occurredAt: Date, months: number): Date {
  const targetYear = occurredAt.getUTCFullYear();
  const targetMonth = occurredAt.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(occurredAt.getUTCDate(), lastDayOfTargetMonth),
      occurredAt.getUTCHours(),
      occurredAt.getUTCMinutes(),
      occurredAt.getUTCSeconds(),
      occurredAt.getUTCMilliseconds(),
    ),
  );
}

function validateCatalog(catalog: UsageEventCatalog): void {
  for (const [eventName, definition] of Object.entries(catalog)) {
    if (!isNonEmptyStringWithin(eventName, MAX_CATALOG_IDENTIFIER_LENGTH)) {
      throw new Error('El nombre de un evento de uso del catálogo no es válido.');
    }
    if (!isNonEmptyStringWithin(definition.appKey, MAX_CATALOG_IDENTIFIER_LENGTH)) {
      throw new Error('La appKey de un evento de uso del catálogo no es válida.');
    }
    if (
      !isMetadataDefinitionArray(definition.metadataFields) ||
      definition.metadataFields.length > MAX_CATALOG_METADATA_FIELDS
    ) {
      throw new Error('El catálogo de uso supera el máximo de campos de metadata.');
    }

    const names = new Set<string>();
    for (const field of definition.metadataFields) {
      if (
        !isNonEmptyStringWithin(field.name, MAX_CATALOG_IDENTIFIER_LENGTH) ||
        names.has(field.name) ||
        typeof field.required !== 'boolean' ||
        !['string', 'uuid', 'number', 'boolean'].includes(field.type)
      ) {
        throw new Error('El catálogo de uso contiene un campo de metadata inválido.');
      }
      names.add(field.name);
      if (field.type === 'string') {
        if (
          !Number.isInteger(field.maxLength) ||
          field.maxLength < 1 ||
          field.maxLength > USAGE_EVENT_INPUT_METADATA_MAX_BYTES
        ) {
          throw new Error('El catálogo de uso contiene un límite de texto inválido.');
        }
        if (
          field.allowedValues !== undefined &&
          (!isStringArray(field.allowedValues) ||
            field.allowedValues.some(
              (allowedValue) => !isNonEmptyStringWithin(allowedValue, field.maxLength),
            ))
        ) {
          throw new Error('El catálogo de uso contiene un valor de texto no permitido.');
        }
      }
    }

    if (
      definition.target !== undefined &&
      (!isNonEmptyStringWithin(definition.target.targetType, MAX_CATALOG_IDENTIFIER_LENGTH) ||
        typeof definition.target.required !== 'boolean' ||
        !Number.isInteger(definition.target.maxIdLength) ||
        definition.target.maxIdLength < 1 ||
        definition.target.maxIdLength > MAX_TARGET_ID_LENGTH)
    ) {
      throw new Error('El catálogo de uso contiene una definición de objetivo inválida.');
    }
  }
}

export function isEventIdUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
    return false;
  }

  if (
    'meta' in error &&
    typeof error.meta === 'object' &&
    error.meta !== null &&
    'target' in error.meta
  ) {
    const target = error.meta.target;
    if (
      (Array.isArray(target) &&
        target.length === 1 &&
        (target[0] === 'event_id' || target[0] === 'eventId')) ||
      target === 'event_id' ||
      target === 'eventId'
    ) {
      return true;
    }
  }

  // Prisma 7 con el adaptador PostgreSQL no expone meta.target para este P2002: conserva el
  // campo inequívoco en el mensaje. No se registra meta para evitar diagnosticar datos crudos.
  return (
    error instanceof Error &&
    error.message.includes('Unique constraint failed on the fields: (`event_id`)')
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isNonEmptyStringWithin(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function isMetadataDefinitionArray(
  value: unknown,
): value is readonly UsageEventMetadataFieldDefinition[] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  const arrayValue = Array.isArray(value) ? (value as unknown[]) : undefined;
  return arrayValue?.every((item) => typeof item === 'string') ?? false;
}
