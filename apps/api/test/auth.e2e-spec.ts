import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UserStatus, type User } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';
import { AuthPublicError } from '../src/modules/auth/auth-public.errors';
import { OAuthLoginAttemptUnavailableError } from '../src/modules/auth/auth-persistence.errors';
import { OAuthLoginAttemptsService } from '../src/modules/auth/oauth-login-attempts.service';
import { UserSessionsService } from '../src/modules/auth/user-sessions.service';
import { UsersService } from '../src/modules/users/users.service';
import {
  GoogleSubjectAlreadyLinkedError,
  UserInactiveError,
  UserNotFoundError,
} from '../src/modules/users/users.errors';

const TEST_ORIGIN = 'http://localhost:5173';
const createUser = (): User => ({
  id: randomUUID(),
  corporateEmail: 'persona@example.test',
  displayName: 'Persona',
  googleSubject: randomUUID(),
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
});

describe('autenticación HTTP (e2e)', () => {
  let app: INestApplication;
  const googleOAuthService = {
    createAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
  };
  const oauthLoginAttemptsService = {
    createLoginAttempt: jest.fn(),
    consumeLoginAttempt: jest.fn(),
  };
  const userSessionsService = {
    createSession: jest.fn(),
    findActiveSession: jest.fn(),
    revokeSession: jest.fn(),
  };
  const usersService = {
    linkGoogleSubject: jest.fn(),
    findActiveUserById: jest.fn(),
  };
  const originalEnvironment = {
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };

  beforeAll(async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
    process.env.CORS_ORIGIN = TEST_ORIGIN;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(GoogleOAuthService)
      .useValue(googleOAuthService)
      .overrideProvider(OAuthLoginAttemptsService)
      .useValue(oauthLoginAttemptsService)
      .overrideProvider(UserSessionsService)
      .useValue(userSessionsService)
      .overrideProvider(UsersService)
      .useValue(usersService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, TEST_ORIGIN);
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    const user = createUser();
    jest.mocked(oauthLoginAttemptsService.createLoginAttempt).mockResolvedValue({
      id: randomUUID(),
      state: randomUUID(),
      codeChallenge: randomUUID(),
      expiresAt: new Date(),
    });
    jest
      .mocked(googleOAuthService.createAuthorizationUrl)
      .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth');
    jest.mocked(oauthLoginAttemptsService.consumeLoginAttempt).mockResolvedValue({
      id: randomUUID(),
      pkceVerifier: randomUUID(),
      expiresAt: new Date(),
    });
    jest.mocked(googleOAuthService.exchangeAuthorizationCode).mockResolvedValue({
      subject: user.googleSubject ?? '',
      email: user.corporateEmail,
    });
    jest.mocked(usersService.linkGoogleSubject).mockResolvedValue(user);
    jest.mocked(userSessionsService.createSession).mockResolvedValue({
      id: randomUUID(),
      token: randomUUID(),
      expiresAt: new Date(),
    });
    jest.mocked(userSessionsService.findActiveSession).mockResolvedValue({ userId: user.id });
    jest.mocked(usersService.findActiveUserById).mockResolvedValue(user);
    jest.mocked(userSessionsService.revokeSession).mockResolvedValue(true);
  });

  afterAll(async () => {
    await app.close();
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  });

  it('redirige a Google, completa la sesión y expone sólo la identidad segura', async () => {
    const server = app.getHttpServer() as Server;
    await request(server).get('/api/auth/google').expect(302);

    const agent = request.agent(server);
    await agent
      .get(`/api/auth/google/callback?state=${randomUUID()}&code=${randomUUID()}`)
      .expect(303);
    const session = await agent.get('/api/auth/session').expect(200);

    // response.body es provisto por supertest como any; sólo se lo usa como entrada de la aserción de Jest.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sessionBody = session.body;
    expect(sessionBody).toEqual({
      // expect.any(...) de Jest está tipado como any; no hay alternativa tipada.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      id: expect.any(String),
      corporateEmail: 'persona@example.test',
      displayName: 'Persona',
    });
    expect(JSON.stringify(sessionBody)).not.toContain('token');
  });

  it('consume el callback una sola vez y nunca crea cookie ante un intento inválido', async () => {
    jest
      .mocked(oauthLoginAttemptsService.consumeLoginAttempt)
      .mockRejectedValue(new OAuthLoginAttemptUnavailableError('consumeOAuthLoginAttempt'));

    const response = await request(app.getHttpServer() as Server)
      .get(`/api/auth/google/callback?state=${randomUUID()}&code=${randomUUID()}`)
      .expect(303);

    expect(response.headers.location).toBe(`${TEST_ORIGIN}/?auth_error=LOGIN_ATTEMPT_INVALID`);
    expect(response.headers.location).not.toContain('state=');
    expect(response.headers.location).not.toContain('code=');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(userSessionsService.createSession).not.toHaveBeenCalled();
  });

  it('consume un state válido aunque Google cancele o falte code, y rechaza su segundo uso', async () => {
    const state = randomUUID();
    oauthLoginAttemptsService.consumeLoginAttempt.mockResolvedValueOnce({
      id: randomUUID(),
      pkceVerifier: randomUUID(),
      expiresAt: new Date(),
    });
    oauthLoginAttemptsService.consumeLoginAttempt.mockRejectedValueOnce(
      new OAuthLoginAttemptUnavailableError('consumeOAuthLoginAttempt'),
    );

    const cancelledResponse = await request(app.getHttpServer() as Server)
      .get(`/api/auth/google/callback?state=${state}&error=access_denied`)
      .expect(303);
    expect(cancelledResponse.headers.location).toBe(
      `${TEST_ORIGIN}/?auth_error=LOGIN_RESPONSE_INVALID`,
    );
    expect(cancelledResponse.headers['set-cookie']).toBeUndefined();

    const reusedResponse = await request(app.getHttpServer() as Server)
      .get(`/api/auth/google/callback?state=${state}&code=${randomUUID()}`)
      .expect(303);
    expect(reusedResponse.headers.location).toBe(
      `${TEST_ORIGIN}/?auth_error=LOGIN_ATTEMPT_INVALID`,
    );
    expect(userSessionsService.createSession).not.toHaveBeenCalled();
  });

  it('consume state antes de rechazar un callback sin code, y no consume uno ausente', async () => {
    const state = randomUUID();
    await request(app.getHttpServer() as Server)
      .get(`/api/auth/google/callback?state=${state}`)
      .expect(303);
    expect(oauthLoginAttemptsService.consumeLoginAttempt).toHaveBeenCalledWith(state);

    await request(app.getHttpServer() as Server)
      .get(`/api/auth/google/callback?code=${randomUUID()}`)
      .expect(303);
    expect(oauthLoginAttemptsService.consumeLoginAttempt).toHaveBeenCalledTimes(1);
  });

  it('redirige los rechazos públicos OAuth al origen configurado con un código estable', async () => {
    const cases = [
      {
        errorCode: 'USER_NOT_AUTHORIZED',
        prepare: () =>
          usersService.linkGoogleSubject.mockRejectedValue(new UserNotFoundError('corporateEmail')),
      },
      {
        errorCode: 'USER_INACTIVE',
        prepare: () =>
          usersService.linkGoogleSubject.mockRejectedValue(new UserInactiveError('userId')),
      },
      {
        errorCode: 'GOOGLE_IDENTITY_MISMATCH',
        prepare: () =>
          usersService.linkGoogleSubject.mockRejectedValue(
            new GoogleSubjectAlreadyLinkedError('googleSubject'),
          ),
      },
      {
        errorCode: 'GOOGLE_IDENTITY_INVALID',
        prepare: () =>
          googleOAuthService.exchangeAuthorizationCode.mockRejectedValue(
            new AuthPublicError('GOOGLE_IDENTITY_INVALID', 401),
          ),
      },
    ];

    for (const { errorCode, prepare } of cases) {
      prepare();

      const response = await request(app.getHttpServer() as Server)
        .get(`/api/auth/google/callback?state=${randomUUID()}&code=${randomUUID()}`)
        .expect(303);

      expect(response.headers.location).toBe(`${TEST_ORIGIN}/?auth_error=${errorCode}`);
      expect(response.headers.location).not.toContain('state=');
      expect(response.headers.location).not.toContain('code=');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(userSessionsService.createSession).not.toHaveBeenCalled();
      jest.mocked(googleOAuthService.exchangeAuthorizationCode).mockResolvedValue({
        subject: randomUUID(),
        email: 'persona@example.test',
      });
      jest.mocked(usersService.linkGoogleSubject).mockResolvedValue(createUser());
    }
  });

  it('aplica CORS con credenciales sólo al origen exacto', async () => {
    const allowedResponse = await request(app.getHttpServer() as Server)
      .options('/api/auth/logout')
      .set('Origin', TEST_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'x-timbo-csrf')
      .expect(204);
    expect(allowedResponse.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(allowedResponse.headers['access-control-allow-credentials']).toBe('true');

    const rejectedResponse = await request(app.getHttpServer() as Server)
      .options('/api/auth/logout')
      .set('Origin', 'http://unexpected.example.test')
      .set('Access-Control-Request-Method', 'POST')
      .expect(404);
    expect(rejectedResponse.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('exige Origin y header CSRF para logout, y no presenta éxito ante una falla de DB', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/auth/logout')
      .expect(403);

    const persistenceFailure = new Error('fallo de persistencia');
    jest.mocked(userSessionsService.revokeSession).mockRejectedValue(persistenceFailure);
    const failedLogout = await request(app.getHttpServer() as Server)
      .post('/api/auth/logout')
      .set('Origin', TEST_ORIGIN)
      .set('x-timbo-csrf', '1')
      .set('Cookie', `timbo_session=${randomUUID()}`)
      .expect(500);
    expect(failedLogout.body).toEqual({ code: 'INTERNAL_ERROR' });

    jest.mocked(userSessionsService.revokeSession).mockResolvedValue(false);
    await request(app.getHttpServer() as Server)
      .post('/api/auth/logout')
      .set('Origin', TEST_ORIGIN)
      .set('x-timbo-csrf', '1')
      .expect(204);
  });
});
