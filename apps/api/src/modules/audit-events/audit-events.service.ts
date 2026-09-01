import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma, type AuditEvent } from '../../generated/prisma/client';
import { RequestContextService } from '../observability/request-context.service';
import {
  AUDIT_EVENT_CATALOG,
  LOGIN_DENIED_REASON_CODES,
  type AuditEventName,
  type AuditTargetRule,
  type LoginDeniedReasonCode,
} from './audit-event-catalog';

const AUDIT_RETENTION_MONTHS = 12;

export interface UserAuditActor {
  actorType: typeof AuditActorType.USER;
  actorUserId: string;
}

export interface SystemAuditActor {
  actorType: typeof AuditActorType.SYSTEM;
  systemActorKey: string;
}

export interface AnonymousAuditActor {
  actorType: typeof AuditActorType.ANONYMOUS;
}

export type AuditActor = UserAuditActor | SystemAuditActor | AnonymousAuditActor;

export interface AuditTarget {
  targetType: string;
  targetId: string;
}

export type AuditEventMetadata = Readonly<{
  reasonCode?: LoginDeniedReasonCode;
  applicationId?: string;
  profileId?: string;
  permissionId?: string;
}>;

export interface AppendAuditEventInput {
  eventName: AuditEventName;
  actor: AuditActor;
  target?: AuditTarget;
  metadata?: AuditEventMetadata;
}

@Injectable()
export class AuditEventsService {
  public constructor(private readonly requestContext: RequestContextService) {}

  public async append(
    transactionClient: Prisma.TransactionClient,
    input: AppendAuditEventInput,
  ): Promise<AuditEvent> {
    const definition = AUDIT_EVENT_CATALOG[input.eventName];
    this.validateActor(input.actor, definition.actorType);
    this.validateTarget(input.target, definition.targetRule);
    this.validateMetadata(input.metadata, definition.metadataFields);

    const occurredAt = new Date();
    const expiresAt = addCalendarMonthsUtc(occurredAt, AUDIT_RETENTION_MONTHS);

    return transactionClient.auditEvent.create({
      data: {
        actorUserId: input.actor.actorType === AuditActorType.USER ? input.actor.actorUserId : null,
        actorType: input.actor.actorType,
        systemActorKey:
          input.actor.actorType === AuditActorType.SYSTEM ? input.actor.systemActorKey : null,
        appKey: definition.appKey,
        eventName: input.eventName,
        outcome: definition.outcome,
        targetType: input.target?.targetType ?? null,
        targetId: input.target?.targetId ?? null,
        requestId: this.requestContext.getRequestId() ?? randomUUID(),
        metadata: input.metadata ?? {},
        occurredAt,
        expiresAt,
      },
    });
  }

  private validateActor(actor: AuditActor, expectedActorType: AuditActorType): void {
    if (actor.actorType !== expectedActorType) {
      throw new Error('El actor no coincide con el catálogo del evento de auditoría.');
    }

    if (actor.actorType === AuditActorType.USER) {
      if (actor.actorUserId.trim().length === 0 || 'systemActorKey' in actor) {
        throw new Error('El actor USER de auditoría requiere sólo un identificador de usuario.');
      }
    }

    if (actor.actorType === AuditActorType.SYSTEM) {
      if (
        !['preauthorize-user-cli', 'assign-platform-admin-cli'].includes(actor.systemActorKey) ||
        'actorUserId' in actor
      ) {
        throw new Error('La clave del actor SYSTEM no está autorizada para auditoría.');
      }
    }

    if (
      actor.actorType === AuditActorType.ANONYMOUS &&
      ('actorUserId' in actor || 'systemActorKey' in actor)
    ) {
      throw new Error('El actor ANONYMOUS de auditoría no admite identificadores.');
    }
  }

  private validateTarget(target: AuditTarget | undefined, targetRule: AuditTargetRule): void {
    if (targetRule === 'forbidden' && target !== undefined) {
      throw new Error('El catálogo del evento de auditoría no admite objetivo.');
    }

    if (targetRule === 'user-required') {
      if (target === undefined) {
        throw new Error('El catálogo del evento de auditoría requiere un usuario objetivo.');
      }

      if (target.targetType !== 'user' || target.targetId.trim().length === 0) {
        throw new Error('El catálogo del evento de auditoría requiere un usuario objetivo.');
      }
    }

    if (targetRule === 'application-required') {
      if (target?.targetType !== 'application' || target.targetId.trim().length === 0) {
        throw new Error('El catálogo del evento de auditoría requiere una aplicación objetivo.');
      }
    }

    if (targetRule === 'meta-company-resource-required') {
      if (
        target === undefined ||
        ![
          'commercial_empresa',
          'commercial_brand',
          'commercial_business',
          'commercial_advisor',
          'commercial_brand_goal',
          'commercial_advisor_goal',
        ].includes(
          target.targetType,
        ) ||
        target.targetId.trim().length === 0
      ) {
        throw new Error('El catálogo de auditoría requiere un recurso de Meta Company.');
      }
    }
  }

  private validateMetadata(
    metadata: AuditEventMetadata | undefined,
    allowedFields: readonly string[],
  ): void {
    const unknownField = Object.keys(metadata ?? {}).find(
      (field) => !allowedFields.includes(field),
    );

    if (unknownField !== undefined) {
      throw new Error('La metadata contiene un campo no permitido por el catálogo de auditoría.');
    }

    const reasonCode = metadata?.reasonCode;
    if (
      allowedFields.includes('reasonCode') &&
      (reasonCode === undefined || !LOGIN_DENIED_REASON_CODES.includes(reasonCode))
    ) {
      throw new Error('El evento de auditoría requiere un reasonCode permitido por el catálogo.');
    }
    const missingField = allowedFields.find(
      (field) => metadata?.[field as keyof AuditEventMetadata] === undefined,
    );
    if (missingField !== undefined) {
      throw new Error('El evento de auditoría requiere toda la metadata definida por el catálogo.');
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
