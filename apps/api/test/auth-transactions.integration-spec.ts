import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { AuditEventsService } from '../src/modules/audit-events/audit-events.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';
import { OAuthLoginAttemptsService } from '../src/modules/auth/oauth-login-attempts.service';
import { UserSessionsService } from '../src/modules/auth/user-sessions.service';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersService } from '../src/modules/users/users.service';

interface IntegrationEnvironment {
  AUTH_TRANSACTIONS_INTEGRATION_TEST_RUN?: string;
  DATABASE_TEST_ENVIRONMENT?: string;
  DATABASE_URL?: string;
}

const requireDedicatedIntegrationTestRun = (environment: IntegrationEnvironment): void => {
  if (environment.AUTH_TRANSACTIONS_INTEGRATION_TEST_RUN !== '1') {
    throw new Error(
      'La prueba de integración de transacciones de auth sólo puede ejecutarse mediante test:auth:transactions:integration.',
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

describe('guardia de integración de transacciones de auth', () => {
  it('requiere la señal del script dedicado antes de construir Nest', () => {
    expect(() => {
      requireDedicatedIntegrationTestRun({ DATABASE_TEST_ENVIRONMENT: 'development' });
    }).toThrow('test:auth:transactions:integration');
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

describe('AuthService contra PostgreSQL development: fronteras transaccionales reales', () => {
  let moduleFixture: TestingModule | undefined;
  let authService: AuthService;
  let prismaService: PrismaService;
  let usersService: UsersService;
  let auditEventsService: AuditEventsService;
  let oauthLoginAttemptsService: OAuthLoginAttemptsService;
  let userSessionsService: UserSessionsService;
  const googleOAuthService = {
    createAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
  };

  beforeAll(async () => {
    requireDevelopmentIntegrationEnvironment(process.env);

    moduleFixture = await Test.createTestingModule({
      imports: [AuthModule, UsersModule],
    })
      .overrideProvider(GoogleOAuthService)
      .useValue(googleOAuthService)
      .compile();
    await moduleFixture.init();

    authService = moduleFixture.get(AuthService);
    prismaService = moduleFixture.get(PrismaService);
    usersService = moduleFixture.get(UsersService);
    auditEventsService = moduleFixture.get(AuditEventsService);
    oauthLoginAttemptsService = moduleFixture.get(OAuthLoginAttemptsService);
    userSessionsService = moduleFixture.get(UserSessionsService);
  });

  afterAll(async () => {
    if (moduleFixture !== undefined) {
      await moduleFixture.close();
    }
  });

  it('el login exitoso vincula Google, crea sesión y audita en una sola transacción; si la auditoría falla, Postgres revierte todo', async () => {
    // Mecanismo de fallo controlado: se espía append() en el mismo singleton de
    // AuditEventsService que inyecta AuthService, forzando exactamente una escritura fallida
    // dentro de la transacción real. No requiere tocar schema ni SQL, y no deja mutación parcial
    // porque Postgres revierte la transacción completa cuando el callback rechaza.
    const successEmail = `auth-tx-success-${randomUUID()}@example.test`;
    const rollbackEmail = `auth-tx-rollback-${randomUUID()}@example.test`;
    let successUserId: string | undefined;
    let rollbackUserId: string | undefined;
    const attemptIds: string[] = [];

    try {
      const successUser = await usersService.preauthorizeUser({ corporateEmail: successEmail });
      successUserId = successUser.id;
      const rollbackUser = await usersService.preauthorizeUser({ corporateEmail: rollbackEmail });
      rollbackUserId = rollbackUser.id;

      const successAttempt = await oauthLoginAttemptsService.createLoginAttempt();
      attemptIds.push(successAttempt.id);
      googleOAuthService.exchangeAuthorizationCode.mockResolvedValueOnce({
        subject: `google-${successUserId}`,
        email: successEmail,
      });

      const loginResult = await authService.completeGoogleLogin({
        state: successAttempt.state,
        code: 'fake-code',
      });
      expect(typeof loginResult.token).toBe('string');

      const linkedUser = await prismaService.user.findUniqueOrThrow({
        where: { id: successUserId },
      });
      expect(linkedUser.googleSubject).toBe(`google-${successUserId}`);
      await expect(
        prismaService.userSession.findMany({ where: { userId: successUserId } }),
      ).resolves.toHaveLength(1);
      await expect(
        prismaService.auditEvent.findMany({
          where: { actorUserId: successUserId, eventName: 'security.login_succeeded' },
        }),
      ).resolves.toHaveLength(1);

      const rollbackAttempt = await oauthLoginAttemptsService.createLoginAttempt();
      attemptIds.push(rollbackAttempt.id);
      googleOAuthService.exchangeAuthorizationCode.mockResolvedValueOnce({
        subject: `google-${rollbackUserId}`,
        email: rollbackEmail,
      });
      const injectedFailure = new Error(
        'fallo de auditoría inyectado para la prueba de integración',
      );
      const appendSpy = jest
        .spyOn(auditEventsService, 'append')
        .mockRejectedValueOnce(injectedFailure);

      await expect(
        authService.completeGoogleLogin({ state: rollbackAttempt.state, code: 'fake-code' }),
      ).rejects.toBe(injectedFailure);

      appendSpy.mockRestore();

      const unlinkedUser = await prismaService.user.findUniqueOrThrow({
        where: { id: rollbackUserId },
      });
      expect(unlinkedUser.googleSubject).toBeNull();
      await expect(
        prismaService.userSession.findMany({ where: { userId: rollbackUserId } }),
      ).resolves.toHaveLength(0);
      await expect(
        prismaService.auditEvent.findMany({ where: { actorUserId: rollbackUserId } }),
      ).resolves.toHaveLength(0);
    } finally {
      await prismaService.oAuthLoginAttempt.deleteMany({ where: { id: { in: attemptIds } } });
      for (const userId of [successUserId, rollbackUserId]) {
        if (userId === undefined) {
          continue;
        }
        await prismaService.userSession.deleteMany({ where: { userId } });
        await prismaService.auditEvent.deleteMany({
          where: { OR: [{ actorUserId: userId }, { targetType: 'user', targetId: userId }] },
        });
        await prismaService.user.delete({ where: { id: userId } });
      }
    }
  }, 30_000);

  it('el logout revoca la sesión y audita en una transacción; si la auditoría falla, la sesión permanece activa en Postgres', async () => {
    const fixtureEmail = `auth-tx-logout-${randomUUID()}@example.test`;
    let userId: string | undefined;
    const sessionIds: string[] = [];

    try {
      const user = await usersService.preauthorizeUser({ corporateEmail: fixtureEmail });
      userId = user.id;

      const activeSession = await userSessionsService.createSession(prismaService, { userId });
      sessionIds.push(activeSession.id);

      await authService.logout(activeSession.token);

      const revokedRow = await prismaService.userSession.findUniqueOrThrow({
        where: { id: activeSession.id },
      });
      expect(revokedRow.revokedAt).not.toBeNull();
      await expect(
        prismaService.auditEvent.findMany({
          where: { actorUserId: userId, eventName: 'security.logout' },
        }),
      ).resolves.toHaveLength(1);

      const secondSession = await userSessionsService.createSession(prismaService, { userId });
      sessionIds.push(secondSession.id);
      const injectedFailure = new Error(
        'fallo de auditoría inyectado para la prueba de integración',
      );
      const appendSpy = jest
        .spyOn(auditEventsService, 'append')
        .mockRejectedValueOnce(injectedFailure);

      await expect(authService.logout(secondSession.token)).rejects.toBe(injectedFailure);

      appendSpy.mockRestore();

      const stillActiveRow = await prismaService.userSession.findUniqueOrThrow({
        where: { id: secondSession.id },
      });
      expect(stillActiveRow.revokedAt).toBeNull();
    } finally {
      await prismaService.userSession.deleteMany({ where: { id: { in: sessionIds } } });
      if (userId !== undefined) {
        await prismaService.auditEvent.deleteMany({
          where: { OR: [{ actorUserId: userId }, { targetType: 'user', targetId: userId }] },
        });
        await prismaService.user.delete({ where: { id: userId } });
      }
    }
  }, 30_000);
});
