import { ExecutionContext } from '@nestjs/common';
import { UserStatus, type User } from '../../generated/prisma/client';
import { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { Seguimiento5sApplicationAccessGuard } from './seguimiento-5s-application-access.guard';

const createContext = (authenticatedUser: User | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ authenticatedUser }) }),
  }) as unknown as ExecutionContext;

const authenticatedUser: User = {
  id: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6',
  corporateEmail: 'persona@timbo.com',
  displayName: 'Persona Timbo',
  googleSubject: null,
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
};

describe('Seguimiento5sApplicationAccessGuard', () => {
  const applicationAuthorizationService = { hasApplicationAccess: jest.fn() };
  const guard = new Seguimiento5sApplicationAccessGuard(
    applicationAuthorizationService as unknown as ApplicationAuthorizationService,
  );

  beforeEach(() => applicationAuthorizationService.hasApplicationAccess.mockReset());

  it('autoriza al usuario que tiene Seguimiento 5S asignada y activa', async () => {
    applicationAuthorizationService.hasApplicationAccess.mockResolvedValue(true);

    await expect(guard.canActivate(createContext(authenticatedUser))).resolves.toBe(true);
    expect(applicationAuthorizationService.hasApplicationAccess).toHaveBeenCalledWith(
      authenticatedUser.id,
      'seguimiento-5s',
    );
  });

  it('rechaza al usuario que no tiene la aplicación asignada', async () => {
    applicationAuthorizationService.hasApplicationAccess.mockResolvedValue(false);

    await expect(guard.canActivate(createContext(authenticatedUser))).rejects.toEqual(
      expect.objectContaining({ code: 'AUTHORIZATION_REQUIRED', statusCode: 403 }),
    );
  });

  it('falla explícitamente si no se ejecutó antes el guard de sesión', async () => {
    await expect(guard.canActivate(createContext(undefined))).rejects.toThrow('guard de sesión');
    expect(applicationAuthorizationService.hasApplicationAccess).not.toHaveBeenCalled();
  });
});
