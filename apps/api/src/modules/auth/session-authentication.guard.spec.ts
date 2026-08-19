import { randomUUID } from 'node:crypto';
import { ExecutionContext } from '@nestjs/common';
import { UserStatus, type User } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { UserSessionUnavailableError } from './auth-persistence.errors';
import { SessionAuthenticationGuard } from './session-authentication.guard';
import { UserSessionsService } from './user-sessions.service';

const createContext = (cookieHeader: string | undefined): ExecutionContext => {
  const request = {
    header: jest.fn((headerName: string) => (headerName === 'cookie' ? cookieHeader : undefined)),
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

const createUser = (): User => ({
  id: randomUUID(),
  corporateEmail: 'persona@example.test',
  displayName: null,
  googleSubject: null,
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
});

describe('SessionAuthenticationGuard', () => {
  const userSessionsService = { findActiveSession: jest.fn() };
  const usersService = { findActiveUserById: jest.fn() };
  let guard: SessionAuthenticationGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new SessionAuthenticationGuard(
      userSessionsService as unknown as UserSessionsService,
      usersService as unknown as UsersService,
    );
  });

  it('resuelve la sesión y consulta el estado ACTIVE del usuario en cada petición', async () => {
    const user = createUser();
    const token = randomUUID();
    userSessionsService.findActiveSession.mockResolvedValue({ userId: user.id });
    usersService.findActiveUserById.mockResolvedValue(user);

    await expect(guard.canActivate(createContext(`timbo_session=${token}`))).resolves.toBe(true);
    expect(usersService.findActiveUserById).toHaveBeenCalledWith({ userId: user.id });
  });

  it('rechaza una sesión ausente, vencida o revocada', async () => {
    await expect(guard.canActivate(createContext(undefined))).rejects.toEqual(
      expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED' }),
    );

    userSessionsService.findActiveSession.mockRejectedValue(
      new UserSessionUnavailableError('findActiveUserSession'),
    );
    await expect(guard.canActivate(createContext(`timbo_session=${randomUUID()}`))).rejects.toEqual(
      expect.objectContaining({ code: 'AUTHENTICATION_REQUIRED' }),
    );
  });

  it('propaga una caída de persistencia sin traducirla a acceso denegado', async () => {
    const persistenceFailure = new Error('fallo de persistencia');
    userSessionsService.findActiveSession.mockRejectedValue(persistenceFailure);

    await expect(guard.canActivate(createContext(`timbo_session=${randomUUID()}`))).rejects.toBe(
      persistenceFailure,
    );
  });
});
