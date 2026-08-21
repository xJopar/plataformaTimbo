import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/database/prisma.module';
import { PrismaService } from '../src/database/prisma.service';
import { AuditActorType, AuditOutcome } from '../src/generated/prisma/client';
import { AuditEventsModule } from '../src/modules/audit-events/audit-events.module';
import { AuditEventsService } from '../src/modules/audit-events/audit-events.service';
import { RequestContextService } from '../src/modules/observability/request-context.service';

interface IntegrationEnvironment {
  AUDIT_EVENTS_INTEGRATION_TEST_RUN?: string;
  DATABASE_TEST_ENVIRONMENT?: string;
  DATABASE_URL?: string;
}

const requireDedicatedIntegrationTestRun = (environment: IntegrationEnvironment): void => {
  if (environment.AUDIT_EVENTS_INTEGRATION_TEST_RUN !== '1') {
    throw new Error(
      'La prueba de integración de auditoría sólo puede ejecutarse mediante test:audit-events:integration.',
    );
  }
};

const requireDevelopmentIntegrationEnvironment = (environment: IntegrationEnvironment): void => {
  if (environment.DATABASE_TEST_ENVIRONMENT !== 'development') {
    throw new Error('La prueba de integración requiere DATABASE_TEST_ENVIRONMENT=development.');
  }

  if (environment.DATABASE_URL === undefined || environment.DATABASE_URL.length === 0) {
    throw new Error('La prueba de integración requiere DATABASE_URL.');
  }
};

requireDedicatedIntegrationTestRun(process.env);

describe('guardia de integración de auditoría', () => {
  it('requiere la señal del script dedicado antes de construir Nest', () => {
    expect(() => {
      requireDedicatedIntegrationTestRun({ DATABASE_TEST_ENVIRONMENT: 'development' });
    }).toThrow('test:audit-events:integration');
  });

  it('se niega antes de conectar cuando falta la confirmación de development', () => {
    expect(() => {
      requireDevelopmentIntegrationEnvironment({ DATABASE_URL: 'configured' });
    }).toThrow('DATABASE_TEST_ENVIRONMENT=development');
  });

  it('se niega antes de conectar cuando falta DATABASE_URL', () => {
    expect(() => {
      requireDevelopmentIntegrationEnvironment({ DATABASE_TEST_ENVIRONMENT: 'development' });
    }).toThrow('DATABASE_URL');
  });
});

describe('AuditEventsService contra PostgreSQL development', () => {
  let moduleFixture: TestingModule | undefined;
  let auditEventsService: AuditEventsService;
  let prismaService: PrismaService;
  let requestContext: RequestContextService;

  beforeAll(async () => {
    requireDevelopmentIntegrationEnvironment(process.env);

    moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, AuditEventsModule],
    }).compile();
    await moduleFixture.init();
    auditEventsService = moduleFixture.get(AuditEventsService);
    prismaService = moduleFixture.get(PrismaService);
    requestContext = moduleFixture.get(RequestContextService);
  });

  afterAll(async () => {
    if (moduleFixture !== undefined) {
      await moduleFixture.close();
    }
  });

  it('persiste actores USER y SYSTEM, y revierte el evento junto a su transacción', async () => {
    const userId = randomUUID();
    const userEmail = `audit-events-integration-${userId}@example.test`;
    const persistedAuditEventIds: string[] = [];
    let rolledBackAuditEventId: string | undefined;

    try {
      await prismaService.user.create({
        data: {
          id: userId,
          corporateEmail: userEmail,
        },
      });

      const systemAuditEvent = await requestContext.run(
        { requestId: `audit-system-${userId}` },
        () =>
          prismaService.$transaction((transactionClient) =>
            auditEventsService.append(transactionClient, {
              eventName: 'access.user_preauthorized',
              actor: {
                actorType: AuditActorType.SYSTEM,
                systemActorKey: 'preauthorize-user-cli',
              },
              target: { targetType: 'user', targetId: userId },
            }),
          ),
      );
      persistedAuditEventIds.push(systemAuditEvent.id);
      expect(systemAuditEvent).toMatchObject({
        actorType: AuditActorType.SYSTEM,
        actorUserId: null,
        systemActorKey: 'preauthorize-user-cli',
        targetType: 'user',
        targetId: userId,
        outcome: AuditOutcome.SUCCESS,
      });

      const userAuditEvent = await prismaService.$transaction((transactionClient) =>
        auditEventsService.append(transactionClient, {
          eventName: 'security.login_succeeded',
          actor: { actorType: AuditActorType.USER, actorUserId: userId },
        }),
      );
      persistedAuditEventIds.push(userAuditEvent.id);
      expect(userAuditEvent).toMatchObject({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        systemActorKey: null,
        outcome: AuditOutcome.SUCCESS,
      });

      const rollbackError = new Error('Reversión de prueba de auditoría.');
      await expect(
        prismaService.$transaction(async (transactionClient) => {
          const auditEvent = await auditEventsService.append(transactionClient, {
            eventName: 'security.login_succeeded',
            actor: { actorType: AuditActorType.USER, actorUserId: userId },
          });
          rolledBackAuditEventId = auditEvent.id;
          throw rollbackError;
        }),
      ).rejects.toBe(rollbackError);

      if (rolledBackAuditEventId === undefined) {
        throw new Error('La prueba no obtuvo el identificador exacto del evento revertido.');
      }

      await expect(
        prismaService.auditEvent.findUnique({ where: { id: rolledBackAuditEventId } }),
      ).resolves.toBeNull();

      await expect(
        prismaService.auditEvent.create({
          data: {
            id: randomUUID(),
            actorType: AuditActorType.SYSTEM,
            systemActorKey: 'preauthorize-user-cli',
            appKey: ' ',
            eventName: 'integration.invalid-check',
            outcome: AuditOutcome.SUCCESS,
            requestId: `audit-check-${userId}`,
            metadata: {},
            occurredAt: new Date('2026-08-21T12:00:00.000Z'),
            expiresAt: new Date('2027-08-21T12:00:00.000Z'),
          },
        }),
      ).rejects.toBeDefined();

      await expect(
        prismaService.auditEvent.create({
          data: {
            id: randomUUID(),
            actorType: AuditActorType.USER,
            actorUserId: randomUUID(),
            appKey: 'platform',
            eventName: 'integration.invalid-foreign-key',
            outcome: AuditOutcome.SUCCESS,
            requestId: `audit-fk-${userId}`,
            metadata: {},
            occurredAt: new Date('2026-08-21T12:00:00.000Z'),
            expiresAt: new Date('2027-08-21T12:00:00.000Z'),
          },
        }),
      ).rejects.toBeDefined();
    } finally {
      for (const auditEventId of persistedAuditEventIds) {
        await prismaService.auditEvent.delete({ where: { id: auditEventId } });
      }

      await prismaService.user.delete({ where: { id: userId } });
    }
  }, 30_000);
});
