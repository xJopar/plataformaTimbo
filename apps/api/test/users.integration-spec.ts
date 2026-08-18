import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { UserStatus } from '../src/generated/prisma/client';
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

  beforeAll(async () => {
    requireDevelopmentIntegrationEnvironment(process.env);

    moduleFixture = await Test.createTestingModule({
      imports: [UsersModule],
    }).compile();
    await moduleFixture.init();
    usersService = moduleFixture.get(UsersService);
    prismaService = moduleFixture.get(PrismaService);
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
        usersService.linkGoogleSubject({
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
        usersService.deactivateUser({ corporateEmail: fixtureEmail }),
      ).resolves.toMatchObject({
        status: UserStatus.INACTIVE,
        // expect.any(...) de Jest está tipado como "any" en @types/jest; no hay alternativa tipada.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        deactivatedAt: expect.any(Date),
      });
      await expect(
        usersService.reactivateUser({ corporateEmail: fixtureEmail }),
      ).resolves.toMatchObject({
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
      });
    } finally {
      if (fixtureId !== undefined) {
        await prismaService.user.delete({ where: { id: fixtureId } });
      }
    }
  });
});
