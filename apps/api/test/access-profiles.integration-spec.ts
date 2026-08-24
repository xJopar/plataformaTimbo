import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/database/prisma.module';
import { PrismaService } from '../src/database/prisma.service';
import { AuditEventsService } from '../src/modules/audit-events/audit-events.service';
import { AccessProfilesModule } from '../src/modules/access-profiles/access-profiles.module';
import { FirstPlatformAdministratorAlreadyAssignedError } from '../src/modules/access-profiles/access-profiles.errors';
import { AccessProfilesService } from '../src/modules/access-profiles/access-profiles.service';

interface IntegrationEnvironment {
  ACCESS_PROFILES_INTEGRATION_TEST_RUN?: string;
  DATABASE_TEST_ENVIRONMENT?: string;
  DATABASE_URL?: string;
}

function requireDedicatedIntegrationTestRun(environment: IntegrationEnvironment): void {
  if (environment.ACCESS_PROFILES_INTEGRATION_TEST_RUN !== '1') {
    throw new Error(
      'La prueba de perfiles de acceso sólo puede ejecutarse mediante test:access-profiles:integration.',
    );
  }
}

function requireDevelopmentIntegrationEnvironment(environment: IntegrationEnvironment): void {
  if (environment.DATABASE_TEST_ENVIRONMENT !== 'development') {
    throw new Error('La prueba de integración requiere DATABASE_TEST_ENVIRONMENT=development.');
  }
  if (environment.DATABASE_URL === undefined || environment.DATABASE_URL.length === 0) {
    throw new Error('La prueba de integración requiere DATABASE_URL.');
  }
}

requireDedicatedIntegrationTestRun(process.env);

async function cleanupFixtures(
  prismaService: PrismaService,
  userIds: readonly string[],
  profileId: string | undefined,
): Promise<void> {
  const assignments = await prismaService.userProfileAssignment.findMany({
    where: { userId: { in: [...userIds] } },
    select: { id: true },
  });
  for (const assignment of assignments) {
    await prismaService.userProfileAssignment.delete({ where: { id: assignment.id } });
  }
  await prismaService.auditEvent.deleteMany({
    where: { targetType: 'user', targetId: { in: [...userIds] } },
  });
  if (profileId !== undefined) {
    const profile = await prismaService.accessProfile.findUnique({ where: { id: profileId } });
    if (profile !== null) {
      await prismaService.accessProfile.delete({ where: { id: profileId } });
    }
  }
  for (const userId of userIds) {
    const user = await prismaService.user.findUnique({ where: { id: userId } });
    if (user !== null) {
      await prismaService.user.delete({ where: { id: userId } });
    }
  }

  const remainingUsers = await prismaService.user.count({ where: { id: { in: [...userIds] } } });
  const remainingAssignments = await prismaService.userProfileAssignment.count({
    where: { userId: { in: [...userIds] } },
  });
  if (remainingUsers !== 0 || remainingAssignments !== 0) {
    throw new Error('La integración dejó fixtures propios sin limpiar.');
  }
}

describe('AccessProfilesService contra PostgreSQL development', () => {
  let moduleFixture: TestingModule | undefined;
  let prismaService: PrismaService;
  let accessProfilesService: AccessProfilesService;

  beforeAll(async () => {
    requireDevelopmentIntegrationEnvironment(process.env);
    moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, AccessProfilesModule],
    }).compile();
    await moduleFixture.init();
    prismaService = moduleFixture.get(PrismaService);
    accessProfilesService = moduleFixture.get(AccessProfilesService);
  });

  afterAll(async () => {
    if (moduleFixture !== undefined) {
      await moduleFixture.close();
    }
  });

  it('serializa dos comandos concurrentes y revierte una asignación si la auditoría falla', async () => {
    const userIds = [randomUUID(), randomUUID()];
    const emails = userIds.map((id) => `access-profiles-${id}@example.test`);
    let profileId: string | undefined;
    let profileCreatedByThisTest = false;

    try {
      const existingProfile = await prismaService.accessProfile.findFirst({
        where: { key: 'PLATFORM_ADMIN', scope: 'SYSTEM' },
      });
      if (existingProfile !== null) {
        const existingAssignments = await prismaService.userProfileAssignment.count({
          where: { profileId: existingProfile.id },
        });
        if (existingAssignments !== 0) {
          throw new Error('La integración requiere un perfil PLATFORM_ADMIN sin asignaciones.');
        }
      } else {
        profileCreatedByThisTest = true;
      }
      await Promise.all(
        userIds.map((id, index) =>
          prismaService.user.create({
            data: { id, corporateEmail: emails[index] ?? '' },
          }),
        ),
      );

      const results = await Promise.allSettled(
        emails.map((corporateEmail) =>
          accessProfilesService.assignFirstPlatformAdministrator({ corporateEmail }),
        ),
      );
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(FirstPlatformAdministratorAlreadyAssignedError);

      const profile = await prismaService.accessProfile.findFirst({
        where: { key: 'PLATFORM_ADMIN', scope: 'SYSTEM' },
      });
      if (profile === null) {
        throw new Error('La integración no creó el perfil PLATFORM_ADMIN.');
      }
      profileId = profile.id;
      await expect(
        prismaService.userProfileAssignment.count({ where: { profileId: profile.id } }),
      ).resolves.toBe(1);
    } finally {
      await cleanupFixtures(
        prismaService,
        userIds,
        profileCreatedByThisTest ? profileId : undefined,
      );
    }

    const rollbackUserId = randomUUID();
    const rollbackEmail = `access-profiles-rollback-${rollbackUserId}@example.test`;
    let rollbackModule: TestingModule | undefined;
    try {
      await prismaService.user.create({
        data: { id: rollbackUserId, corporateEmail: rollbackEmail },
      });
      rollbackModule = await Test.createTestingModule({
        imports: [PrismaModule, AccessProfilesModule],
      })
        .overrideProvider(AuditEventsService)
        .useValue({ append: jest.fn().mockRejectedValue(new Error('auditoría no disponible')) })
        .compile();
      await rollbackModule.init();
      const rollbackService = rollbackModule.get(AccessProfilesService);

      await expect(
        rollbackService.assignFirstPlatformAdministrator({ corporateEmail: rollbackEmail }),
      ).rejects.toThrow('auditoría no disponible');
      const rollbackProfile = await prismaService.accessProfile.findFirst({
        where: { key: 'PLATFORM_ADMIN', scope: 'SYSTEM' },
      });
      if (rollbackProfile !== null) {
        await expect(
          prismaService.userProfileAssignment.count({ where: { profileId: rollbackProfile.id } }),
        ).resolves.toBe(0);
      }
    } finally {
      if (rollbackModule !== undefined) {
        await rollbackModule.close();
      }
      await cleanupFixtures(prismaService, [rollbackUserId], undefined);
    }
  }, 30_000);
});
