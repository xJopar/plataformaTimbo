import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { AuditActorType, UserStatus } from '../src/generated/prisma/client';
import { AuditEventsService } from '../src/modules/audit-events/audit-events.service';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersService } from '../src/modules/users/users.service';

interface IntegrationEnvironment {
  USERS_INTEGRATION_TEST_RUN?: string;
  DATABASE_TEST_ENVIRONMENT?: string;
  DATABASE_URL?: string;
}

const requireDedicatedIntegrationTestRun = (environment: IntegrationEnvironment): void => {
  if (environment.USERS_INTEGRATION_TEST_RUN !== '1') {
    throw new Error(
      'La prueba de integración sólo puede ejecutarse mediante test:users:integration.',
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

describe('guardia de integración de usuarios', () => {
  it('requiere la señal del script dedicado antes de construir Nest', () => {
    expect(() => {
      requireDedicatedIntegrationTestRun({ DATABASE_TEST_ENVIRONMENT: 'development' });
    }).toThrow('test:users:integration');
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

describe('UsersService contra PostgreSQL development', () => {
  let moduleFixture: TestingModule | undefined;
  let usersService: UsersService;
  let prismaService: PrismaService;
  let auditEventsService: AuditEventsService;

  beforeAll(async () => {
    requireDevelopmentIntegrationEnvironment(process.env);

    moduleFixture = await Test.createTestingModule({
      imports: [UsersModule],
    }).compile();
    await moduleFixture.init();
    usersService = moduleFixture.get(UsersService);
    prismaService = moduleFixture.get(PrismaService);
    auditEventsService = moduleFixture.get(AuditEventsService);
  });

  afterAll(async () => {
    if (moduleFixture !== undefined) {
      await moduleFixture.close();
    }
  });

  it('persiste el ciclo interno y limpia solamente su fixture', async () => {
    const fixtureEmail = `users-integration-${randomUUID()}@example.test`;
    let fixtureId: string | undefined;

    try {
      const preauthorizedUser = await usersService.preauthorizeUser({
        corporateEmail: `  ${fixtureEmail.toUpperCase()}  `,
        displayName: '  Usuario de integración  ',
      });
      fixtureId = preauthorizedUser.id;

      expect(preauthorizedUser).toMatchObject({
        corporateEmail: fixtureEmail,
        displayName: 'Usuario de integración',
        googleSubject: null,
        zohoCrmUserId: null,
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
      });

      await expect(
        usersService.findByCorporateEmail({ corporateEmail: fixtureEmail.toUpperCase() }),
      ).resolves.toMatchObject({ id: preauthorizedUser.id });
      await expect(
        usersService.linkGoogleSubject(prismaService, {
          corporateEmail: fixtureEmail,
          googleSubject: `google-${fixtureId}`,
        }),
      ).resolves.toMatchObject({ googleSubject: `google-${fixtureId}` });
      await expect(
        usersService.saveZohoCrmUserId({
          corporateEmail: fixtureEmail,
          zohoCrmUserId: `zoho-${fixtureId}`,
        }),
      ).resolves.toMatchObject({ zohoCrmUserId: `zoho-${fixtureId}` });
      await expect(
        usersService.deactivateUser({ corporateEmail: fixtureEmail, actorUserId: fixtureId }),
      ).resolves.toMatchObject({
        status: UserStatus.INACTIVE,
        // expect.any(...) de Jest está tipado como "any" en @types/jest; no hay alternativa tipada.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        deactivatedAt: expect.any(Date),
      });
      await expect(
        usersService.reactivateUser({ corporateEmail: fixtureEmail, actorUserId: fixtureId }),
      ).resolves.toMatchObject({
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
      });

      const relatedAuditEvents = await prismaService.auditEvent.findMany({
        where: { targetType: 'user', targetId: fixtureId },
        orderBy: { occurredAt: 'asc' },
      });
      expect(relatedAuditEvents.map((event) => event.eventName)).toEqual([
        'access.user_preauthorized',
        'access.user_deactivated',
        'access.user_reactivated',
      ]);
      expect(relatedAuditEvents[0]).toMatchObject({
        actorType: AuditActorType.SYSTEM,
        systemActorKey: 'preauthorize-user-cli',
      });
      expect(relatedAuditEvents[1]).toMatchObject({
        actorType: AuditActorType.USER,
        actorUserId: fixtureId,
      });
      expect(relatedAuditEvents[2]).toMatchObject({
        actorType: AuditActorType.USER,
        actorUserId: fixtureId,
      });
    } finally {
      if (fixtureId !== undefined) {
        await prismaService.auditEvent.deleteMany({
          where: { targetType: 'user', targetId: fixtureId },
        });
        await prismaService.user.delete({ where: { id: fixtureId } });
      }
    }
  }, 30_000);

  it('revierte de verdad en Postgres cuando la auditoría obligatoria falla', async () => {
    // Mecanismo de fallo controlado: se espía el método real de AuditEventsService (mismo
    // singleton que usa UsersService) para forzar exactamente una escritura fallida dentro de
    // la transacción real, sin tocar schema ni SQL. Cada mutación + su auditoría corren en la
    // misma transacción Prisma contra Postgres, así que esto demuestra un rollback real.
    const fixtureEmail = `users-integration-rollback-${randomUUID()}@example.test`;
    const injectedFailure = new Error('fallo de auditoría inyectado para la prueba de integración');
    let fixtureId: string | undefined;

    try {
      await expect(
        (async () => {
          const appendSpy = jest
            .spyOn(auditEventsService, 'append')
            .mockRejectedValueOnce(injectedFailure);
          try {
            return await usersService.preauthorizeUser({ corporateEmail: fixtureEmail });
          } finally {
            appendSpy.mockRestore();
          }
        })(),
      ).rejects.toBe(injectedFailure);

      await expect(
        prismaService.user.findUnique({ where: { corporateEmail: fixtureEmail } }),
      ).resolves.toBeNull();

      const user = await usersService.preauthorizeUser({ corporateEmail: fixtureEmail });
      fixtureId = user.id;

      await expect(
        (async () => {
          const appendSpy = jest
            .spyOn(auditEventsService, 'append')
            .mockRejectedValueOnce(injectedFailure);
          try {
            return await usersService.deactivateUser({
              corporateEmail: fixtureEmail,
              actorUserId: fixtureId,
            });
          } finally {
            appendSpy.mockRestore();
          }
        })(),
      ).rejects.toBe(injectedFailure);

      await expect(
        prismaService.user.findUniqueOrThrow({ where: { id: fixtureId } }),
      ).resolves.toMatchObject({ status: UserStatus.ACTIVE, deactivatedAt: null });

      await usersService.deactivateUser({ corporateEmail: fixtureEmail, actorUserId: fixtureId });

      await expect(
        (async () => {
          const appendSpy = jest
            .spyOn(auditEventsService, 'append')
            .mockRejectedValueOnce(injectedFailure);
          try {
            return await usersService.reactivateUser({
              corporateEmail: fixtureEmail,
              actorUserId: fixtureId,
            });
          } finally {
            appendSpy.mockRestore();
          }
        })(),
      ).rejects.toBe(injectedFailure);

      await expect(
        prismaService.user.findUniqueOrThrow({ where: { id: fixtureId } }),
      ).resolves.toMatchObject({ status: UserStatus.INACTIVE });
    } finally {
      // fixtureId puede quedar sin asignar si una expectativa de rechazo falla antes de la
      // segunda llamada a preauthorizeUser (por ejemplo, si el fallo inyectado no se consume y
      // la primera llamada crea al usuario de verdad). Por eso el cleanup localiza el fixture
      // por su fixtureEmail único, no por la variable, y borra cada fila por ID exacto.
      const orphanedUser = await prismaService.user.findUnique({
        where: { corporateEmail: fixtureEmail },
        select: { id: true },
      });

      if (orphanedUser !== null) {
        const relatedAuditEvents = await prismaService.auditEvent.findMany({
          where: { targetType: 'user', targetId: orphanedUser.id },
          select: { id: true },
        });

        for (const auditEvent of relatedAuditEvents) {
          await prismaService.auditEvent.delete({ where: { id: auditEvent.id } });
        }

        await prismaService.user.delete({ where: { id: orphanedUser.id } });
      }
    }
  }, 30_000);
});
