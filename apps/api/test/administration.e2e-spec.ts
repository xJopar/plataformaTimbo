import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UserStatus, type User } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { ACCESS_PROFILES_SERVICE } from '../src/modules/access-profiles/access-profiles.tokens';
import { AuditEventsService } from '../src/modules/audit-events/audit-events.service';
import { UserSessionsService } from '../src/modules/auth/user-sessions.service';
import { PlatformAdministratorCannotBeDeactivatedError } from '../src/modules/users/users.errors';
import { UsersService } from '../src/modules/users/users.service';

const TEST_ORIGIN = 'http://localhost:5173';

const createUser = (overrides: Partial<User> = {}): User => ({
  id: randomUUID(),
  corporateEmail: 'persona@example.test',
  displayName: 'Persona',
  googleSubject: null,
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
  ...overrides,
});

describe('Administración HTTP (e2e)', () => {
  let app: INestApplication;
  const actor = createUser();
  const target = createUser();
  const usersService = {
    findActiveUserById: jest.fn(),
    findUserById: jest.fn(),
    deactivateUser: jest.fn(),
  };
  const userSessionsService = { findActiveSession: jest.fn() };
  const accessProfilesService = { hasActivePlatformAdministratorAssignment: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(UsersService)
      .useValue(usersService)
      .overrideProvider(UserSessionsService)
      .useValue(userSessionsService)
      .overrideProvider(ACCESS_PROFILES_SERVICE)
      .useValue(accessProfilesService)
      .overrideProvider(AuditEventsService)
      .useValue({})
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app, TEST_ORIGIN);
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    userSessionsService.findActiveSession.mockResolvedValue({ userId: actor.id });
    usersService.findActiveUserById.mockResolvedValue(actor);
    accessProfilesService.hasActivePlatformAdministratorAssignment.mockResolvedValue(true);
    usersService.findUserById.mockResolvedValue(target);
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve un rechazo estable y no confirma la desactivación de un PLATFORM_ADMIN', async () => {
    usersService.deactivateUser.mockRejectedValue(
      new PlatformAdministratorCannotBeDeactivatedError(),
    );

    const response = await request(app.getHttpServer() as Server)
      .post(`/api/admin/users/${target.id}/deactivate`)
      .set('Cookie', `timbo_session=${randomUUID()}`)
      .set('Origin', TEST_ORIGIN)
      .set('x-timbo-csrf', '1')
      .expect(409);

    expect(response.body).toEqual({ code: 'PLATFORM_ADMIN_DEACTIVATION_FORBIDDEN' });
    expect(usersService.deactivateUser).toHaveBeenCalledWith({
      corporateEmail: target.corporateEmail,
      actorUserId: actor.id,
    });
  });
});
