import { AuditActorType, UserStatus, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { FirstPlatformAdministratorAlreadyAssignedError } from './access-profiles.errors';
import { AccessProfilesService } from './access-profiles.service';

const user: User = {
  id: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6',
  corporateEmail: 'admin@timbo.com',
  displayName: 'Administrador',
  googleSubject: null,
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-08-21T12:00:00.000Z'),
  updatedAt: new Date('2026-08-21T12:00:00.000Z'),
  deactivatedAt: null,
};

describe('AccessProfilesService', () => {
  const findPlatformAdminAssignment = jest.fn();
  const runTransaction = jest.fn();
  const appendAuditEvent = jest.fn();
  const transactionClient = {
    accessProfile: { findFirst: jest.fn(), create: jest.fn() },
    $queryRaw: jest.fn(),
    userProfileAssignment: { findFirst: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const prisma = {
    userProfileAssignment: { findFirst: findPlatformAdminAssignment },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const auditEventsService = { append: appendAuditEvent } as unknown as AuditEventsService;
  const service = new AccessProfilesService(prisma, auditEventsService);

  beforeEach(() => {
    transactionClient.accessProfile.findFirst.mockReset();
    transactionClient.accessProfile.create.mockReset();
    transactionClient.$queryRaw.mockReset();
    transactionClient.$queryRaw.mockResolvedValue([{ id: 'profile-a' }]);
    transactionClient.userProfileAssignment.findFirst.mockReset();
    transactionClient.userProfileAssignment.create.mockReset();
    transactionClient.user.findUnique.mockReset();
    findPlatformAdminAssignment.mockReset();
    runTransaction.mockReset();
    runTransaction.mockImplementation(
      (callback: (transaction: typeof transactionClient) => unknown) => callback(transactionClient),
    );
    appendAuditEvent.mockReset();
  });

  it('consulta sólo una asignación activa del perfil PLATFORM_ADMIN', async () => {
    findPlatformAdminAssignment.mockResolvedValue({ id: 'assignment-a' });

    await expect(service.hasActivePlatformAdministratorAssignment(user.id)).resolves.toBe(true);
    expect(findPlatformAdminAssignment).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        profile: { key: 'PLATFORM_ADMIN', scope: 'SYSTEM', status: 'ACTIVE' },
      },
      select: { id: true },
    });
  });

  it('asigna explícitamente sólo el primer administrador y lo audita como comando de sistema', async () => {
    transactionClient.accessProfile.findFirst.mockResolvedValue({ id: 'profile-a' });
    transactionClient.userProfileAssignment.findFirst.mockResolvedValue(null);
    transactionClient.user.findUnique.mockResolvedValue(user);
    transactionClient.userProfileAssignment.create.mockResolvedValue({ id: 'assignment-a' });
    appendAuditEvent.mockResolvedValue(undefined);

    await expect(
      service.assignFirstPlatformAdministrator({ corporateEmail: ' ADMIN@TIMBO.COM ' }),
    ).resolves.toBe(user);

    expect(transactionClient.accessProfile.findFirst).toHaveBeenCalledWith({
      where: { key: 'PLATFORM_ADMIN', scope: 'SYSTEM' },
    });
    expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transactionClient.userProfileAssignment.create).toHaveBeenCalledWith({
      data: { userId: user.id, profileId: 'profile-a' },
    });
    expect(appendAuditEvent).toHaveBeenCalledWith(transactionClient, {
      eventName: 'access.platform_admin_assigned',
      actor: { actorType: AuditActorType.SYSTEM, systemActorKey: 'assign-platform-admin-cli' },
      target: { targetType: 'user', targetId: user.id },
    });
  });

  it('no permite que el comando asigne un segundo administrador', async () => {
    transactionClient.accessProfile.findFirst.mockResolvedValue({ id: 'profile-a' });
    transactionClient.userProfileAssignment.findFirst.mockResolvedValue({ id: 'assignment-a' });

    await expect(
      service.assignFirstPlatformAdministrator({ corporateEmail: user.corporateEmail }),
    ).rejects.toBeInstanceOf(FirstPlatformAdministratorAlreadyAssignedError);
    expect(transactionClient.user.findUnique).not.toHaveBeenCalled();
    expect(transactionClient.userProfileAssignment.create).not.toHaveBeenCalled();
  });

  it('reintenta una vez el P2002 específico del perfil antes de obtener su bloqueo', async () => {
    runTransaction.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['key'] } });
    transactionClient.accessProfile.findFirst.mockResolvedValue({ id: 'profile-a' });
    transactionClient.userProfileAssignment.findFirst.mockResolvedValue(null);
    transactionClient.user.findUnique.mockResolvedValue(user);
    transactionClient.userProfileAssignment.create.mockResolvedValue({ id: 'assignment-a' });
    appendAuditEvent.mockResolvedValue(undefined);

    await expect(
      service.assignFirstPlatformAdministrator({ corporateEmail: user.corporateEmail }),
    ).resolves.toBe(user);

    expect(runTransaction).toHaveBeenCalledTimes(2);
  });
});
