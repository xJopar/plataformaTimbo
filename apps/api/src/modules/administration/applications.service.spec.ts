import { BadRequestException, ConflictException } from '@nestjs/common';
import { ApplicationStatus, AuditActorType, type Application } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { ApplicationsService } from './applications.service';

const application: Application = {
  id: '80aa0b7c-36bd-4d13-8d6c-fdbb0a64aa90',
  key: 'hello-world',
  name: 'Hello World',
  description: 'Primera aplicación de Plataforma Timbo.',
  launchPath: '/apps/hello-world',
  status: ApplicationStatus.ACTIVE,
  displayOrder: 0,
  createdAt: new Date('2026-08-24T12:00:00.000Z'),
  updatedAt: new Date('2026-08-24T12:00:00.000Z'),
  deactivatedAt: null,
};

describe('ApplicationsService', () => {
  const transactionClient = {
    application: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const prisma = {
    application: { findMany: jest.fn() },
    $transaction: jest.fn(async (execute: (client: typeof transactionClient) => Promise<unknown>) =>
      execute(transactionClient),
    ),
  };
  const auditEventsService = { append: jest.fn() };
  const service = new ApplicationsService(
    prisma as unknown as PrismaService,
    auditEventsService as unknown as AuditEventsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea una aplicación normalizada y audita al administrador de la sesión', async () => {
    transactionClient.application.create.mockResolvedValue(application);
    auditEventsService.append.mockResolvedValue(undefined);

    await expect(
      service.createAdministrativeApplication({
        key: ' Hello-World ',
        name: ' Hello World ',
        description: ' Primera aplicación de Plataforma Timbo. ',
        launchPath: ' /apps/hello-world ',
        displayOrder: 0,
        actorUserId: 'administrator-a',
      }),
    ).resolves.toEqual(application);

    expect(transactionClient.application.create).toHaveBeenCalledWith({
      data: {
        key: 'hello-world',
        name: 'Hello World',
        description: 'Primera aplicación de Plataforma Timbo.',
        launchPath: '/apps/hello-world',
        displayOrder: 0,
      },
    });
    expect(auditEventsService.append).toHaveBeenCalledWith(transactionClient, {
      eventName: 'access.application_created',
      actor: { actorType: AuditActorType.USER, actorUserId: 'administrator-a' },
      target: { targetType: 'application', targetId: application.id },
    });
  });

  it('rechaza rutas externas antes de tocar la base de datos', async () => {
    await expect(
      service.createAdministrativeApplication({
        key: 'externa',
        name: 'Externa',
        launchPath: 'https://example.com',
        displayOrder: 0,
        actorUserId: 'administrator-a',
      }),
    ).rejects.toEqual(expect.any(BadRequestException));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('traduce una clave o ruta repetida a conflicto público', async () => {
    transactionClient.application.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.createAdministrativeApplication({
        key: 'hello-world',
        name: 'Otra',
        launchPath: '/apps/otra',
        displayOrder: 1,
        actorUserId: 'administrator-a',
      }),
    ).rejects.toEqual(expect.any(ConflictException));
  });

  it('desactiva sin borrar el registro y emite el evento correspondiente', async () => {
    transactionClient.application.updateMany.mockResolvedValue({ count: 1 });
    auditEventsService.append.mockResolvedValue(undefined);

    await service.deactivateAdministrativeApplication({
      applicationId: application.id,
      actorUserId: 'administrator-a',
    });

    expect(transactionClient.application.updateMany).toHaveBeenCalledWith({
      where: { id: application.id, status: ApplicationStatus.ACTIVE },
      data: {
        status: ApplicationStatus.INACTIVE,
        deactivatedAt: expect.any(Date) as Date,
      },
    });
    expect(auditEventsService.append).toHaveBeenCalledWith(transactionClient, {
      eventName: 'access.application_deactivated',
      actor: { actorType: AuditActorType.USER, actorUserId: 'administrator-a' },
      target: { targetType: 'application', targetId: application.id },
    });
  });
});
