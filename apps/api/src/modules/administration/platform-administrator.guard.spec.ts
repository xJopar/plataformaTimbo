import { ExecutionContext } from '@nestjs/common';
import { UserStatus, type User } from '../../generated/prisma/client';
import { AccessProfilesService } from '../access-profiles/access-profiles.service';
import { PlatformAdministratorGuard } from './platform-administrator.guard';

const createContext = (authenticatedUser: User | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ authenticatedUser }) }),
  }) as unknown as ExecutionContext;

const createUser = (): User => ({
  id: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6',
  corporateEmail: 'admin@timbo.com',
  displayName: 'Administrador',
  googleSubject: null,
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
});

describe('PlatformAdministratorGuard', () => {
  const accessProfilesService = { hasActivePlatformAdministratorAssignment: jest.fn() };
  const guard = new PlatformAdministratorGuard(
    accessProfilesService as unknown as AccessProfilesService,
  );

  beforeEach(() => {
    accessProfilesService.hasActivePlatformAdministratorAssignment.mockReset();
  });

  it('autoriza únicamente una asignación PLATFORM_ADMIN obtenida desde la sesión', async () => {
    const user = createUser();
    accessProfilesService.hasActivePlatformAdministratorAssignment.mockResolvedValue(true);

    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);
    expect(accessProfilesService.hasActivePlatformAdministratorAssignment).toHaveBeenCalledWith(
      user.id,
    );
  });

  it('rechaza una sesión sin asignación administrativa', async () => {
    accessProfilesService.hasActivePlatformAdministratorAssignment.mockResolvedValue(false);

    await expect(guard.canActivate(createContext(createUser()))).rejects.toEqual(
      expect.objectContaining({ code: 'AUTHORIZATION_REQUIRED', statusCode: 403 }),
    );
  });

  it('falla explícitamente si no se ejecutó antes el guard de sesión', async () => {
    await expect(guard.canActivate(createContext(undefined))).rejects.toThrow('guard de sesión');
    expect(accessProfilesService.hasActivePlatformAdministratorAssignment).not.toHaveBeenCalled();
  });
});
