import { randomUUID } from 'node:crypto';
import { UserStatus, type User } from '../../generated/prisma/client';
import {
  GoogleSubjectAlreadyLinkedError,
  UserInactiveError,
  UserNotFoundError,
} from '../users/users.errors';
import { UsersService } from '../users/users.service';
import { OAuthLoginAttemptUnavailableError } from './auth-persistence.errors';
import { AuthPublicError } from './auth-public.errors';
import { AuthService } from './auth.service';
import { OAuthLoginAttemptsService } from './oauth-login-attempts.service';
import { UserSessionsService } from './user-sessions.service';

const createUser = (overrides: Partial<User> = {}): User => ({
  id: randomUUID(),
  corporateEmail: 'persona@example.test',
  displayName: 'Persona',
  googleSubject: 'google-subject',
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
  ...overrides,
});

describe('AuthService', () => {
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
    revokeSession: jest.fn(),
  };
  const usersService = {
    linkGoogleSubject: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(
      googleOAuthService,
      oauthLoginAttemptsService as unknown as OAuthLoginAttemptsService,
      userSessionsService as unknown as UserSessionsService,
      usersService as unknown as UsersService,
    );
  });

  it('inicia Google con el intento que contiene state y challenge, sin exponer el verifier', async () => {
    const loginAttempt = {
      id: randomUUID(),
      state: randomUUID(),
      codeChallenge: randomUUID(),
      expiresAt: new Date(),
    };
    const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    oauthLoginAttemptsService.createLoginAttempt.mockResolvedValue(loginAttempt);
    googleOAuthService.createAuthorizationUrl.mockReturnValue(authorizationUrl);

    await expect(service.beginGoogleLogin()).resolves.toBe(authorizationUrl);
    expect(googleOAuthService.createAuthorizationUrl).toHaveBeenCalledWith(loginAttempt);
  });

  it('consume una vez, valida la identidad y crea una sesión sólo para un usuario activo', async () => {
    const user = createUser();
    const sessionToken = randomUUID();
    oauthLoginAttemptsService.consumeLoginAttempt.mockResolvedValue({
      id: randomUUID(),
      pkceVerifier: randomUUID(),
      expiresAt: new Date(),
    });
    googleOAuthService.exchangeAuthorizationCode.mockResolvedValue({
      subject: user.googleSubject ?? '',
      email: user.corporateEmail,
    });
    usersService.linkGoogleSubject.mockResolvedValue(user);
    userSessionsService.createSession.mockResolvedValue({
      id: randomUUID(),
      token: sessionToken,
      expiresAt: new Date(),
    });

    await expect(
      service.completeGoogleLogin({ state: randomUUID(), code: randomUUID() }),
    ).resolves.toEqual({ token: sessionToken });
    expect(userSessionsService.createSession).toHaveBeenCalledWith({ userId: user.id });
  });

  it.each([
    ['inexistente', new UserNotFoundError('linkGoogleSubject'), 'USER_NOT_AUTHORIZED'],
    ['inactivo', new UserInactiveError('linkGoogleSubject'), 'USER_INACTIVE'],
    [
      'mismatch',
      new GoogleSubjectAlreadyLinkedError('linkGoogleSubject'),
      'GOOGLE_IDENTITY_MISMATCH',
    ],
  ] as const)('no crea sesión si el usuario es %s', async (_scenario, failure, expectedCode) => {
    oauthLoginAttemptsService.consumeLoginAttempt.mockResolvedValue({
      id: randomUUID(),
      pkceVerifier: randomUUID(),
      expiresAt: new Date(),
    });
    googleOAuthService.exchangeAuthorizationCode.mockResolvedValue({
      subject: randomUUID(),
      email: 'persona@example.test',
    });
    usersService.linkGoogleSubject.mockRejectedValue(failure);

    await expect(
      service.completeGoogleLogin({ state: randomUUID(), code: randomUUID() }),
    ).rejects.toEqual(expect.objectContaining({ code: expectedCode, name: AuthPublicError.name }));
    expect(userSessionsService.createSession).not.toHaveBeenCalled();
  });

  it('traduce intento vencido, consumido o ausente a un código público estable', async () => {
    oauthLoginAttemptsService.consumeLoginAttempt.mockRejectedValue(
      new OAuthLoginAttemptUnavailableError('consumeOAuthLoginAttempt'),
    );

    await expect(
      service.completeGoogleLogin({ state: randomUUID(), code: randomUUID() }),
    ).rejects.toEqual(expect.objectContaining({ code: 'LOGIN_ATTEMPT_INVALID' }));
  });

  it('consume state antes de rechazar una cancelación o ausencia de code', async () => {
    const state = randomUUID();
    oauthLoginAttemptsService.consumeLoginAttempt.mockResolvedValue({
      id: randomUUID(),
      pkceVerifier: randomUUID(),
      expiresAt: new Date(),
    });

    await expect(
      service.completeGoogleLogin({ state, providerError: 'access_denied' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'LOGIN_RESPONSE_INVALID' }));
    expect(oauthLoginAttemptsService.consumeLoginAttempt).toHaveBeenCalledWith(state);
    expect(googleOAuthService.exchangeAuthorizationCode).not.toHaveBeenCalled();

    await expect(service.completeGoogleLogin({ state, code: undefined })).rejects.toEqual(
      expect.objectContaining({ code: 'LOGIN_RESPONSE_INVALID' }),
    );
  });

  it('rechaza state ausente sin intentar consumirlo', async () => {
    await expect(service.completeGoogleLogin({ code: randomUUID() })).rejects.toEqual(
      expect.objectContaining({ code: 'LOGIN_ATTEMPT_INVALID' }),
    );
    expect(oauthLoginAttemptsService.consumeLoginAttempt).not.toHaveBeenCalled();
  });

  it('propaga el fallo de persistencia durante logout', async () => {
    const persistenceFailure = new Error('fallo de persistencia');
    userSessionsService.revokeSession.mockRejectedValue(persistenceFailure);

    await expect(service.logout(randomUUID())).rejects.toBe(persistenceFailure);
  });
});
