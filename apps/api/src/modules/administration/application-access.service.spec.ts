/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AccessProfileScope,
  AccessProfileStatus,
  ApplicationPermissionStatus,
  ApplicationStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { ApplicationAccessService } from './application-access.service';

describe('ApplicationAccessService', () => {
  const transaction = {
    user: { findUnique: jest.fn() },
    application: { findUnique: jest.fn() },
    userApplicationAssignment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    accessProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userProfileAssignment: { deleteMany: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    applicationPermission: { findUnique: jest.fn(), findMany: jest.fn() },
    accessProfilePermission: { create: jest.fn(), deleteMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    userApplicationAssignment: { findMany: jest.fn() },
    userProfileAssignment: { findMany: jest.fn() },
    applicationPermission: { findMany: jest.fn() },
    accessProfile: { findMany: jest.fn() },
  } as unknown as PrismaService;
  const audit = { append: jest.fn() } as unknown as AuditEventsService;
  const service = new ApplicationAccessService(prisma, audit);
  const activeApplication = { id: 'app-a', status: ApplicationStatus.ACTIVE };
  const activeUser = { id: 'user-a', status: UserStatus.ACTIVE };
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(prisma.$transaction)
      .mockImplementation((callback) => callback(transaction as never));
    transaction.user.findUnique.mockResolvedValue(activeUser);
    transaction.application.findUnique.mockResolvedValue(activeApplication);
  });

  it('asigna sólo usuario y aplicación activos, persiste y audita en la misma transacción', async () => {
    transaction.userApplicationAssignment.create.mockResolvedValue({ id: 'access-a' });
    await service.assignApplication('actor-a', 'user-a', 'app-a');
    expect(transaction.userApplicationAssignment.create).toHaveBeenCalledWith({
      data: { userId: 'user-a', applicationId: 'app-a' },
    });
    expect(jest.mocked(audit.append)).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        eventName: 'access.user_application_assigned',
        metadata: { applicationId: 'app-a' },
      }),
    );
    transaction.user.findUnique.mockResolvedValue({ ...activeUser, status: UserStatus.INACTIVE });
    await expect(service.assignApplication('actor-a', 'user-a', 'app-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('retira únicamente perfiles de la aplicación retirada y después la asignación', async () => {
    transaction.userApplicationAssignment.findUnique.mockResolvedValue({ id: 'access-a' });
    transaction.accessProfile.findMany.mockResolvedValue([{ id: 'profile-a' }]);
    await service.unassignApplication('actor-a', 'user-a', 'app-a');
    expect(transaction.userProfileAssignment.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', profileId: { in: ['profile-a'] } },
    });
    expect(transaction.userApplicationAssignment.delete).toHaveBeenCalledWith({
      where: { id: 'access-a' },
    });
    expect(jest.mocked(audit.append)).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ eventName: 'access.user_application_unassigned' }),
    );
  });

  it('rechaza permiso de otra aplicación o inactivo', async () => {
    transaction.accessProfile.findUnique.mockResolvedValue({
      id: 'profile-a',
      applicationId: 'app-a',
      scope: AccessProfileScope.APPLICATION,
      status: AccessProfileStatus.ACTIVE,
    });
    transaction.applicationPermission.findUnique.mockResolvedValue({
      id: 'permission-b',
      applicationId: 'app-b',
      status: ApplicationPermissionStatus.ACTIVE,
    });
    await expect(
      service.addPermission('actor-a', 'profile-a', 'permission-b'),
    ).rejects.toBeInstanceOf(BadRequestException);
    transaction.applicationPermission.findUnique.mockResolvedValue({
      id: 'permission-a',
      applicationId: 'app-a',
      status: ApplicationPermissionStatus.INACTIVE,
    });
    await expect(
      service.addPermission('actor-a', 'profile-a', 'permission-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requiere perfil activo y asignación de aplicación para asignar perfil', async () => {
    transaction.accessProfile.findUnique.mockResolvedValue({
      id: 'profile-a',
      applicationId: 'app-a',
      scope: AccessProfileScope.APPLICATION,
      status: AccessProfileStatus.INACTIVE,
    });
    await expect(service.assignProfile('actor-a', 'user-a', 'profile-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    transaction.accessProfile.findUnique.mockResolvedValue({
      id: 'profile-a',
      applicationId: 'app-a',
      scope: AccessProfileScope.APPLICATION,
      status: AccessProfileStatus.ACTIVE,
    });
    transaction.userApplicationAssignment.findUnique.mockResolvedValue(null);
    await expect(service.assignProfile('actor-a', 'user-a', 'profile-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lista una forma estable sin datos personales', async () => {
    jest
      .mocked(prisma.userApplicationAssignment.findMany)
      .mockResolvedValue([
        { applicationId: 'app-a', createdAt: new Date('2026-08-25T00:00:00.000Z') },
      ] as never);
    jest
      .mocked(prisma.userProfileAssignment.findMany)
      .mockResolvedValue([{ profileId: 'profile-a' }] as never);
    await expect(service.listUserApplicationAccesses('user-a')).resolves.toEqual([
      {
        applicationId: 'app-a',
        assignedAt: new Date('2026-08-25T00:00:00.000Z'),
        profileIds: ['profile-a'],
      },
    ]);
  });

  it('asigna en lote y reporta por usuario sin abortar ante un fallo individual', async () => {
    const assignApplication = jest.spyOn(service, 'assignApplication');
    assignApplication.mockResolvedValueOnce(undefined);
    assignApplication.mockRejectedValueOnce(
      new BadRequestException('El usuario y la aplicación deben estar activos.'),
    );

    await expect(
      service.assignApplicationToUsers('actor-a', 'app-a', ['user-a', 'user-b']),
    ).resolves.toEqual([
      { userId: 'user-a', status: 'ASSIGNED' },
      {
        userId: 'user-b',
        status: 'FAILED',
        message: 'El usuario y la aplicación deben estar activos.',
      },
    ]);
    expect(assignApplication).toHaveBeenNthCalledWith(1, 'actor-a', 'user-a', 'app-a');
    expect(assignApplication).toHaveBeenNthCalledWith(2, 'actor-a', 'user-b', 'app-a');
  });

  it('desasigna en lote y reporta por usuario sin abortar ante un fallo individual', async () => {
    const unassignApplication = jest.spyOn(service, 'unassignApplication');
    unassignApplication.mockResolvedValueOnce(undefined);
    unassignApplication.mockRejectedValueOnce(
      new ConflictException('El usuario ya tiene asignada la aplicación.'),
    );

    await expect(
      service.unassignApplicationFromUsers('actor-a', 'app-a', ['user-a', 'user-b']),
    ).resolves.toEqual([
      { userId: 'user-a', status: 'UNASSIGNED' },
      {
        userId: 'user-b',
        status: 'FAILED',
        message: 'El usuario ya tiene asignada la aplicación.',
      },
    ]);
  });
});
