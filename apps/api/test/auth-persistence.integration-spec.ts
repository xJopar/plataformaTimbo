import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { OAuthLoginAttemptUnavailableError } from '../src/modules/auth/auth-persistence.errors';
import {
  OAUTH_LOGIN_ATTEMPT_DURATION_MS,
  OAuthLoginAttemptsService,
} from '../src/modules/auth/oauth-login-attempts.service';
import { UserSessionsService } from '../src/modules/auth/user-sessions.service';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersService } from '../src/modules/users/users.service';

interface IntegrationEnvironment {
  AUTH_PERSISTENCE_INTEGRATION_TEST_RUN?: string;
  DATABASE_TEST_ENVIRONMENT?: string;
  DATABASE_URL?: string;
}

const requireDedicatedIntegrationTestRun = (environment: IntegrationEnvironment): void => {
  if (environment.AUTH_PERSISTENCE_INTEGRATION_TEST_RUN !== '1') {
    throw new Error(
      'La prueba de integracion de persistencia auth solo puede ejecutarse mediante test:auth:persistence:integration.',
    );
  }
};

const requireDevelopmentIntegrationEnvironment = (environment: IntegrationEnvironment): void => {
  if (environment.DATABASE_TEST_ENVIRONMENT !== 'development') {
    throw new Error('La prueba de integracion requiere DATABASE_TEST_ENVIRONMENT=development.');
  }

  if (environment.DATABASE_URL === undefined || environment.DATABASE_URL.length === 0) {
    throw new Error('La prueba de integracion requiere DATABASE_URL.');
  }
};

requireDedicatedIntegrationTestRun(process.env);

describe('guardia de integracion de persistencia auth', () => {
  it('requiere la senal del script dedicado antes de construir Nest', () => {
    expect(() => {
      requireDedicatedIntegrationTestRun({ DATABASE_TEST_ENVIRONMENT: 'development' });
    }).toThrow('test:auth:persistence:integration');
  });

  it('se niega antes de conectar cuando falta la confirmacion de development', () => {
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

describe('persistencia de auth contra PostgreSQL development', () => {
  let moduleFixture: TestingModule | undefined;
  let prismaService: PrismaService;
  let usersService: UsersService;
  let oauthLoginAttemptsService: OAuthLoginAttemptsService;
  let userSessionsService: UserSessionsService;

  beforeAll(async () => {
    requireDevelopmentIntegrationEnvironment(process.env);

    moduleFixture = await Test.createTestingModule({
      imports: [AuthModule, UsersModule],
    }).compile();
    await moduleFixture.init();
    prismaService = moduleFixture.get(PrismaService);
    usersService = moduleFixture.get(UsersService);
    oauthLoginAttemptsService = moduleFixture.get(OAuthLoginAttemptsService);
    userSessionsService = moduleFixture.get(UserSessionsService);
  });

  afterAll(async () => {
    if (moduleFixture !== undefined) {
      await moduleFixture.close();
    }
  });

  it('persiste intentos de un solo uso y sesiones opacas con cleanup exacto', async () => {
    const fixtureEmail = `auth-persistence-${randomUUID()}@example.test`;
    const referenceTime = new Date('2026-08-19T12:00:00.000Z');
    const attemptIds: string[] = [];
    const sessionIds: string[] = [];
    let userId: string | undefined;

    try {
      const activeUser = await usersService.preauthorizeUser({ corporateEmail: fixtureEmail });
      userId = activeUser.id;

      const validAttempt = await oauthLoginAttemptsService.createLoginAttempt(referenceTime);
      attemptIds.push(validAttempt.id);
      await expect(
        oauthLoginAttemptsService.consumeLoginAttempt(
          validAttempt.state,
          new Date(referenceTime.getTime() + 1),
        ),
      ).resolves.toMatchObject({ id: validAttempt.id });
      await expect(
        oauthLoginAttemptsService.consumeLoginAttempt(
          validAttempt.state,
          new Date(referenceTime.getTime() + 2),
        ),
      ).rejects.toBeInstanceOf(OAuthLoginAttemptUnavailableError);

      const expiredAttempt = await oauthLoginAttemptsService.createLoginAttempt(referenceTime);
      attemptIds.push(expiredAttempt.id);
      await expect(
        oauthLoginAttemptsService.consumeLoginAttempt(
          expiredAttempt.state,
          new Date(referenceTime.getTime() + OAUTH_LOGIN_ATTEMPT_DURATION_MS),
        ),
      ).rejects.toBeInstanceOf(OAuthLoginAttemptUnavailableError);

      const session = await userSessionsService.createSession({ userId, now: referenceTime });
      sessionIds.push(session.id);
      await expect(
        userSessionsService.findActiveSession(session.token, new Date(referenceTime.getTime() + 1)),
      ).resolves.toMatchObject({ id: session.id, userId });
      await expect(userSessionsService.revokeSession(session.token)).resolves.toBe(true);
      await expect(userSessionsService.findActiveSession(session.token)).rejects.toMatchObject({
        operation: 'findActiveUserSession',
      });

      const expiredSession = await userSessionsService.createSession({
        userId,
        now: referenceTime,
      });
      sessionIds.push(expiredSession.id);
      await expect(
        userSessionsService.findActiveSession(
          expiredSession.token,
          new Date(referenceTime.getTime() + 8 * 60 * 60 * 1000),
        ),
      ).rejects.toMatchObject({ operation: 'findActiveUserSession' });
    } finally {
      await prismaService.oAuthLoginAttempt.deleteMany({ where: { id: { in: attemptIds } } });
      await prismaService.userSession.deleteMany({ where: { id: { in: sessionIds } } });

      if (userId !== undefined) {
        await prismaService.user.delete({ where: { id: userId } });
      }
    }
  }, 30_000);
});
