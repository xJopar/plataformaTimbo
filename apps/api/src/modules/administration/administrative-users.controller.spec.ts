import { BadRequestException } from '@nestjs/common';
import { UserStatus, type User } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import { PlatformAdministratorCannotBeDeactivatedError } from '../users/users.errors';
import { AdministrativeUsersController } from './administrative-users.controller';

const actorUser = {
  id: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6',
} as User;

const authenticatedRequest = { authenticatedUser: actorUser } as AuthenticatedRequest;

const administrativeUser = {
  id: '4a39f7aa-8e65-4112-ae7d-056a7bbcbd41',
  corporateEmail: 'persona@timbo.com',
  displayName: 'Persona Timbo',
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-08-21T12:00:00.000Z'),
  deactivatedAt: null,
  isPlatformAdministrator: false,
};

describe('AdministrativeUsersController', () => {
  const usersService = {
    listAdministrativeUsers: jest.fn(),
    preauthorizeUserByAdministrator: jest.fn(),
    preauthorizeUsersByAdministrator: jest.fn(),
    updateAdministrativeUser: jest.fn(),
    findUserById: jest.fn(),
    deactivateUser: jest.fn(),
    reactivateUser: jest.fn(),
  };
  const controller = new AdministrativeUsersController(usersService as unknown as UsersService);

  beforeEach(() => {
    Object.values(usersService).forEach((method) => method.mockReset());
  });

  it('deriva el actor de la sesión para preautorizar, sin aceptar actor desde el body', async () => {
    usersService.preauthorizeUserByAdministrator.mockResolvedValue(administrativeUser);

    await expect(
      controller.preauthorizeUser(
        { corporateEmail: administrativeUser.corporateEmail, displayName: 'Persona Timbo' },
        authenticatedRequest,
      ),
    ).resolves.toEqual(administrativeUser);

    expect(usersService.preauthorizeUserByAdministrator).toHaveBeenCalledWith({
      corporateEmail: administrativeUser.corporateEmail,
      displayName: 'Persona Timbo',
      actorUserId: actorUser.id,
    });
  });

  it('preautoriza en lote, mapea cada resultado creado y deriva el actor de la sesión', async () => {
    usersService.preauthorizeUsersByAdministrator.mockResolvedValue([
      {
        corporateEmail: administrativeUser.corporateEmail,
        status: 'CREATED',
        user: {
          id: administrativeUser.id,
          corporateEmail: administrativeUser.corporateEmail,
          displayName: administrativeUser.displayName,
          status: administrativeUser.status,
          createdAt: administrativeUser.createdAt,
          deactivatedAt: administrativeUser.deactivatedAt,
        },
      },
      { corporateEmail: 'repetido@timbo.com', status: 'FAILED', message: 'Ya existe.' },
    ]);

    await expect(
      controller.preauthorizeUsersBulk(
        {
          entries: [
            { corporateEmail: administrativeUser.corporateEmail },
            { corporateEmail: 'repetido@timbo.com' },
          ],
        },
        authenticatedRequest,
      ),
    ).resolves.toEqual([
      {
        corporateEmail: administrativeUser.corporateEmail,
        status: 'CREATED',
        user: { ...administrativeUser, isPlatformAdministrator: false },
      },
      { corporateEmail: 'repetido@timbo.com', status: 'FAILED', message: 'Ya existe.' },
    ]);
    expect(usersService.preauthorizeUsersByAdministrator).toHaveBeenCalledWith({
      entries: [
        { corporateEmail: administrativeUser.corporateEmail },
        { corporateEmail: 'repetido@timbo.com' },
      ],
      actorUserId: actorUser.id,
    });
  });

  it('rechaza un lote vacío o con más entradas de las permitidas', async () => {
    await expect(
      controller.preauthorizeUsersBulk({ entries: [] }, authenticatedRequest),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.preauthorizeUsersBulk(
        {
          entries: Array.from({ length: 201 }, (_, index) => ({
            corporateEmail: `persona-${index.toString()}@timbo.com`,
          })),
        },
        authenticatedRequest,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.preauthorizeUsersByAdministrator).not.toHaveBeenCalled();
  });

  it('actualiza exclusivamente displayName y rechaza un body sin ese campo permitido', async () => {
    usersService.updateAdministrativeUser.mockResolvedValue(administrativeUser);

    await expect(
      controller.updateUser(administrativeUser.id, { displayName: null }, authenticatedRequest),
    ).resolves.toEqual(administrativeUser);
    expect(usersService.updateAdministrativeUser).toHaveBeenCalledWith({
      userId: administrativeUser.id,
      displayName: null,
      actorUserId: actorUser.id,
    });

    await expect(
      controller.updateUser(
        administrativeUser.id,
        {} as { displayName: string | null },
        authenticatedRequest,
      ),
    ).rejects.toThrow('displayName');
  });

  it('resuelve el objetivo por ID y conserva el actor de sesión al cambiar estado', async () => {
    usersService.findUserById.mockResolvedValue(administrativeUser);
    usersService.deactivateUser.mockResolvedValue(administrativeUser);
    usersService.reactivateUser.mockResolvedValue(administrativeUser);

    await controller.deactivateUser(administrativeUser.id, authenticatedRequest);
    await controller.reactivateUser(administrativeUser.id, authenticatedRequest);

    expect(usersService.deactivateUser).toHaveBeenCalledWith({
      corporateEmail: administrativeUser.corporateEmail,
      actorUserId: actorUser.id,
    });
    expect(usersService.reactivateUser).toHaveBeenCalledWith({
      corporateEmail: administrativeUser.corporateEmail,
      actorUserId: actorUser.id,
    });
  });

  it('expone un rechazo público estable cuando se intenta desactivar un administrador', async () => {
    usersService.findUserById.mockResolvedValue(administrativeUser);
    usersService.deactivateUser.mockRejectedValue(
      new PlatformAdministratorCannotBeDeactivatedError(),
    );

    await expect(
      controller.deactivateUser(administrativeUser.id, authenticatedRequest),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'PLATFORM_ADMIN_DEACTIVATION_FORBIDDEN',
        statusCode: 409,
      }),
    );
  });
});
