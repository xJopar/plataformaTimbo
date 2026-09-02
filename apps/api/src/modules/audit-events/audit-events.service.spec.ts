import {
  AuditActorType,
  AuditOutcome,
  Prisma,
  type AuditEvent,
} from '../../generated/prisma/client';
import { RequestContextService } from '../observability/request-context.service';
import { AUDIT_EVENT_CATALOG } from './audit-event-catalog';
import {
  addCalendarMonthsUtc,
  type AuditActor,
  type AuditEventMetadata,
  AuditEventsService,
} from './audit-events.service';

const createAuditEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  id: '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc',
  actorUserId: null,
  actorType: AuditActorType.ANONYMOUS,
  systemActorKey: null,
  appKey: 'platform',
  eventName: 'security.login_denied',
  outcome: AuditOutcome.DENIED,
  targetType: null,
  targetId: null,
  requestId: 'request-a',
  metadata: {},
  occurredAt: new Date('2026-08-21T12:00:00.000Z'),
  expiresAt: new Date('2027-08-21T12:00:00.000Z'),
  ...overrides,
});

describe('AuditEventsService', () => {
  const auditEventCreate = jest.fn<Promise<AuditEvent>, [Prisma.AuditEventCreateArgs]>();
  const auditEventDelegate = { create: auditEventCreate };
  const transactionClient = {
    auditEvent: auditEventDelegate,
  } as unknown as Prisma.TransactionClient;
  let requestContext: RequestContextService;
  let service: AuditEventsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));
    auditEventCreate.mockReset();
    requestContext = new RequestContextService();
    service = new AuditEventsService(requestContext);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('declara eventos de acceso con actor, outcome y metadata controlados', () => {
    expect(Object.keys(AUDIT_EVENT_CATALOG)).toEqual([
      'security.login_succeeded',
      'security.login_denied',
      'security.logout',
      'access.user_preauthorized',
      'access.user_preauthorized_by_administrator',
      'access.user_administrative_data_updated',
      'access.user_deactivated',
      'access.user_reactivated',
      'access.platform_admin_assigned',
      'access.platform_admin_granted',
      'access.platform_admin_revoked',
      'access.application_created',
      'access.application_updated',
      'access.application_deactivated',
      'access.application_reactivated',
      'access.user_application_assigned',
      'access.user_application_unassigned',
      'access.application_profile_created',
      'access.application_profile_updated',
      'access.application_profile_deactivated',
      'access.application_profile_reactivated',
      'access.application_profile_permission_added',
      'access.application_profile_permission_removed',
      'access.user_application_profile_assigned',
      'access.user_application_profile_unassigned',
      'meta-company.goal_created',
      'meta-company.goal_updated',
      'meta-company.empresa_created',
      'meta-company.brand_created',
      'meta-company.brand_deactivated',
      'meta-company.brand_reactivated',
      'meta-company.business_created',
      'meta-company.business_deactivated',
      'meta-company.business_reactivated',
      'meta-company.advisor_created',
      'seguimiento-5s.indicator_created',
      'seguimiento-5s.indicator_updated',
      'seguimiento-5s.indicator_deactivated',
      'seguimiento-5s.indicator_reactivated',
    ]);
    expect(AUDIT_EVENT_CATALOG['security.login_succeeded']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['security.login_denied']).toMatchObject({
      actorType: AuditActorType.ANONYMOUS,
      outcome: AuditOutcome.DENIED,
      metadataFields: ['reasonCode'],
    });
    expect(AUDIT_EVENT_CATALOG['security.logout']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.user_preauthorized']).toMatchObject({
      actorType: AuditActorType.SYSTEM,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.user_preauthorized_by_administrator']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.user_administrative_data_updated']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.user_deactivated']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.user_reactivated']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.platform_admin_assigned']).toMatchObject({
      actorType: AuditActorType.SYSTEM,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.platform_admin_granted']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.platform_admin_revoked']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['access.application_created']).toMatchObject({
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      targetRule: 'application-required',
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['meta-company.goal_created']).toMatchObject({
      appKey: 'meta-company',
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      targetRule: 'meta-company-resource-required',
      metadataFields: [],
    });
    expect(AUDIT_EVENT_CATALOG['seguimiento-5s.indicator_created']).toMatchObject({
      appKey: 'seguimiento-5s',
      actorType: AuditActorType.USER,
      outcome: AuditOutcome.SUCCESS,
      targetRule: 'seguimiento-5s-indicator-required',
      metadataFields: [],
    });
  });

  it('persiste en el TransactionClient el actor SYSTEM de preautorización y el requestId del contexto', async () => {
    const persistedEvent = createAuditEvent({
      actorType: AuditActorType.SYSTEM,
      systemActorKey: 'preauthorize-user-cli',
      eventName: 'access.user_preauthorized',
      outcome: AuditOutcome.SUCCESS,
      targetType: 'user',
      targetId: '7f025649-8238-4958-97a8-f49ea0cd6759',
      requestId: 'request-from-context',
    });
    auditEventCreate.mockResolvedValue(persistedEvent);

    await expect(
      requestContext.run({ requestId: 'request-from-context' }, () =>
        service.append(transactionClient, {
          eventName: 'access.user_preauthorized',
          actor: { actorType: AuditActorType.SYSTEM, systemActorKey: 'preauthorize-user-cli' },
          target: { targetType: 'user', targetId: '7f025649-8238-4958-97a8-f49ea0cd6759' },
        }),
      ),
    ).resolves.toBe(persistedEvent);

    expect(auditEventCreate).toHaveBeenCalledWith({
      data: {
        actorUserId: null,
        actorType: AuditActorType.SYSTEM,
        systemActorKey: 'preauthorize-user-cli',
        appKey: 'platform',
        eventName: 'access.user_preauthorized',
        outcome: AuditOutcome.SUCCESS,
        targetType: 'user',
        targetId: '7f025649-8238-4958-97a8-f49ea0cd6759',
        requestId: 'request-from-context',
        metadata: {},
        occurredAt: new Date('2026-08-21T12:00:00.000Z'),
        expiresAt: new Date('2027-08-21T12:00:00.000Z'),
      },
    });
  });

  it('genera un requestId del backend fuera de un recorrido HTTP', async () => {
    auditEventCreate.mockResolvedValue(createAuditEvent());

    await service.append(transactionClient, {
      eventName: 'security.login_denied',
      actor: { actorType: AuditActorType.ANONYMOUS },
      metadata: { reasonCode: 'USER_NOT_AUTHORIZED' },
    });

    const createArguments = auditEventCreate.mock.calls.at(0);
    if (createArguments === undefined) {
      throw new Error('No se registró la escritura de auditoría.');
    }
    expect(createArguments[0].data.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('rechaza actores, objetivos y metadata que no coinciden con el catálogo', async () => {
    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: { actorType: AuditActorType.USER, actorUserId: 'user-a' },
      }),
    ).rejects.toThrow('El actor no coincide');
    await expect(
      service.append(transactionClient, {
        eventName: 'access.user_deactivated',
        actor: { actorType: AuditActorType.USER, actorUserId: 'user-a' },
      }),
    ).rejects.toThrow('requiere un usuario objetivo');
    await expect(
      service.append(transactionClient, {
        eventName: 'meta-company.goal_created',
        actor: { actorType: AuditActorType.USER, actorUserId: 'user-a' },
        target: { targetType: 'application', targetId: 'meta-a' },
      }),
    ).rejects.toThrow('requiere un recurso de Meta Company');
    await expect(
      service.append(transactionClient, {
        eventName: 'seguimiento-5s.indicator_created',
        actor: { actorType: AuditActorType.USER, actorUserId: 'user-a' },
        target: { targetType: 'application', targetId: 'seguimiento-5s' },
      }),
    ).rejects.toThrow('requiere un indicador de Seguimiento 5S');
    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: { actorType: AuditActorType.ANONYMOUS },
        metadata: { unapproved: 'value' } as unknown as AuditEventMetadata,
      }),
    ).rejects.toThrow('campo no permitido');
    expect(auditEventCreate).not.toHaveBeenCalled();
  });

  it('persiste sólo un reasonCode del catálogo cerrado para login denegado', async () => {
    const persistedEvent = createAuditEvent({
      eventName: 'security.login_denied',
      metadata: { reasonCode: 'USER_INACTIVE' },
    });
    auditEventCreate.mockResolvedValue(persistedEvent);

    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: { actorType: AuditActorType.ANONYMOUS },
        metadata: { reasonCode: 'USER_INACTIVE' },
      }),
    ).resolves.toBe(persistedEvent);

    const createArguments = auditEventCreate.mock.calls.at(0);
    if (createArguments === undefined) {
      throw new Error('No se registró la escritura de auditoría.');
    }
    expect(createArguments[0].data.metadata).toEqual({ reasonCode: 'USER_INACTIVE' });
  });

  it('rechaza login denegado sin reasonCode o con uno fuera del catálogo cerrado', async () => {
    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: { actorType: AuditActorType.ANONYMOUS },
      }),
    ).rejects.toThrow('requiere un reasonCode permitido');
    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: { actorType: AuditActorType.ANONYMOUS },
        metadata: { reasonCode: 'UNKNOWN_REASON' } as unknown as AuditEventMetadata,
      }),
    ).rejects.toThrow('requiere un reasonCode permitido');
    expect(auditEventCreate).not.toHaveBeenCalled();
  });

  it('rechaza una clave SYSTEM no autorizada por el catálogo', async () => {
    await expect(
      service.append(transactionClient, {
        eventName: 'access.user_preauthorized',
        actor: { actorType: AuditActorType.SYSTEM, systemActorKey: 'other-system' },
        target: { targetType: 'user', targetId: '7f025649-8238-4958-97a8-f49ea0cd6759' },
      }),
    ).rejects.toThrow('La clave del actor SYSTEM no está autorizada');

    expect(auditEventCreate).not.toHaveBeenCalled();
  });

  it('rechaza actores USER y ANONYMOUS con identificadores incoherentes', async () => {
    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_succeeded',
        actor: {
          actorType: AuditActorType.USER,
          actorUserId: 'user-a',
          systemActorKey: 'preauthorize-user-cli',
        } as unknown as AuditActor,
      }),
    ).rejects.toThrow('El actor USER de auditoría requiere sólo un identificador de usuario');
    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: {
          actorType: AuditActorType.ANONYMOUS,
          actorUserId: 'user-a',
        } as unknown as AuditActor,
      }),
    ).rejects.toThrow('El actor ANONYMOUS de auditoría no admite identificadores');

    expect(auditEventCreate).not.toHaveBeenCalled();
  });

  it('conserva los doce meses de calendario en fines de mes y años bisiestos', () => {
    expect(addCalendarMonthsUtc(new Date('2024-02-29T18:05:00.000Z'), 12)).toEqual(
      new Date('2025-02-28T18:05:00.000Z'),
    );
    expect(addCalendarMonthsUtc(new Date('2026-01-31T18:05:00.000Z'), 1)).toEqual(
      new Date('2026-02-28T18:05:00.000Z'),
    );
  });

  it('propaga sin ocultar una falla de escritura del TransactionClient', async () => {
    const persistenceError = new Error('fallo de persistencia');
    auditEventCreate.mockRejectedValue(persistenceError);

    await expect(
      service.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: { actorType: AuditActorType.ANONYMOUS },
        metadata: { reasonCode: 'USER_NOT_AUTHORIZED' },
      }),
    ).rejects.toBe(persistenceError);
  });
});
