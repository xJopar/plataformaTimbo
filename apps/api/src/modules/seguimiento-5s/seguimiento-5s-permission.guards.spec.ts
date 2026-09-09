import { ExecutionContext } from '@nestjs/common';
import { UserStatus, type User } from '../../generated/prisma/client';
import { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import {
  Seguimiento5sEntryManagementGuard,
  Seguimiento5sIndicatorManagementGuard,
  Seguimiento5sParticipantManagementGuard,
} from './seguimiento-5s-permission.guards';

const createContext = (authenticatedUser: User | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ authenticatedUser }) }),
  }) as unknown as ExecutionContext;

const authenticatedUser: User = {
  id: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6',
  corporateEmail: 'lider@timbo.com',
  displayName: 'Líder 5S',
  googleSubject: null,
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
};

describe.each([
  [
    'Seguimiento5sIndicatorManagementGuard',
    Seguimiento5sIndicatorManagementGuard,
    'manage-indicators',
  ],
  ['Seguimiento5sEntryManagementGuard', Seguimiento5sEntryManagementGuard, 'manage-entries'],
  [
    'Seguimiento5sParticipantManagementGuard',
    Seguimiento5sParticipantManagementGuard,
    'manage-participants',
  ],
] as const)('%s', (_name, GuardClass, permissionKey) => {
  const applicationAuthorizationService = { hasApplicationPermission: jest.fn() };
  const guard = new GuardClass(
    applicationAuthorizationService as unknown as ApplicationAuthorizationService,
  );

  beforeEach(() => applicationAuthorizationService.hasApplicationPermission.mockReset());

  it(`autoriza cuando el usuario tiene el permiso "${permissionKey}"`, async () => {
    applicationAuthorizationService.hasApplicationPermission.mockResolvedValue(true);

    await expect(guard.canActivate(createContext(authenticatedUser))).resolves.toBe(true);
    expect(applicationAuthorizationService.hasApplicationPermission).toHaveBeenCalledWith(
      authenticatedUser.id,
      'seguimiento-5s',
      permissionKey,
    );
  });

  it('rechaza cuando el usuario no tiene el permiso', async () => {
    applicationAuthorizationService.hasApplicationPermission.mockResolvedValue(false);

    await expect(guard.canActivate(createContext(authenticatedUser))).rejects.toEqual(
      expect.objectContaining({ code: 'AUTHORIZATION_REQUIRED', statusCode: 403 }),
    );
  });

  it('falla explícitamente si no se ejecutó antes el guard de sesión', async () => {
    await expect(guard.canActivate(createContext(undefined))).rejects.toThrow('guard de sesión');
    expect(applicationAuthorizationService.hasApplicationPermission).not.toHaveBeenCalled();
  });
});
