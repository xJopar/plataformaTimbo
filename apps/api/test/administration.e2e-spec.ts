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
import { ActivityService } from '../src/modules/administration/activity.service';
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
  const activityService = {
    list: jest.fn(),
    getStatistics: jest.fn(),
    getFilterOptions: jest.fn(),
    exportCsv: jest.fn(),
  };

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
      .overrideProvider(ActivityService)
      .useValue(activityService)
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
    activityService.list.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
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

  it('protege Actividad con sesión y PLATFORM_ADMIN antes de consultar los eventos', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/admin/activity')
      .expect(401);
    expect(activityService.list).not.toHaveBeenCalled();

    accessProfilesService.hasActivePlatformAdministratorAssignment.mockResolvedValue(false);
    await request(app.getHttpServer() as Server)
      .get('/api/admin/activity')
      .set('Cookie', `timbo_session=${randomUUID()}`)
      .expect(403);
    expect(activityService.list).not.toHaveBeenCalled();
  });

  it('deriva filtros y paginación sólo desde el query protegido', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/admin/activity?source=AUDIT&limit=25&offset=50')
      .set('Cookie', `timbo_session=${randomUUID()}`)
      .expect(200);

    expect(activityService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'AUDIT',
        limit: 25,
        offset: 50,
        datePreset: 'month',
        dateFrom: undefined,
        dateTo: undefined,
        actor: undefined,
        appKey: undefined,
        eventName: undefined,
        target: undefined,
      }),
    );
  });

  it('devuelve códigos estables para rangos de actividad inválidos o demasiado extensos', async () => {
    const invalidRange = await request(app.getHttpServer() as Server)
      .get('/api/admin/activity?dateFrom=2026-08-22&dateTo=2026-08-21')
      .set('Cookie', `timbo_session=${randomUUID()}`)
      .expect(400);
    expect(invalidRange.body).toEqual({ code: 'ACTIVITY_DATE_RANGE_INVALID' });

    const tooLongRange = await request(app.getHttpServer() as Server)
      .get('/api/admin/activity?dateFrom=2025-01-01&dateTo=2026-01-02')
      .set('Cookie', `timbo_session=${randomUUID()}`)
      .expect(400);
    expect(tooLongRange.body).toEqual({ code: 'ACTIVITY_DATE_RANGE_EXCEEDED' });
  });
});
