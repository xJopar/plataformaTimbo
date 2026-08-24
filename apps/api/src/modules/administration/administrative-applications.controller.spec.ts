import { ApplicationStatus, type Application, type User } from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import { AdministrativeApplicationsController } from './administrative-applications.controller';
import { ApplicationsService } from './applications.service';

const actorUser = { id: 'administrator-a' } as User;
const request = { authenticatedUser: actorUser } as AuthenticatedRequest;
const application: Application = {
  id: '80aa0b7c-36bd-4d13-8d6c-fdbb0a64aa90',
  key: 'hello-world',
  name: 'Hello World',
  description: null,
  launchPath: '/apps/hello-world',
  status: ApplicationStatus.ACTIVE,
  displayOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deactivatedAt: null,
};

describe('AdministrativeApplicationsController', () => {
  const applicationsService = {
    listAdministrativeApplications: jest.fn(),
    createAdministrativeApplication: jest.fn(),
    updateAdministrativeApplication: jest.fn(),
    deactivateAdministrativeApplication: jest.fn(),
    reactivateAdministrativeApplication: jest.fn(),
  };
  const controller = new AdministrativeApplicationsController(
    applicationsService as unknown as ApplicationsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('deriva el actor de la sesión al crear la aplicación', async () => {
    applicationsService.createAdministrativeApplication.mockResolvedValue(application);

    await controller.createApplication(
      {
        key: application.key,
        name: application.name,
        description: null,
        launchPath: application.launchPath,
        displayOrder: 0,
      },
      request,
    );

    expect(applicationsService.createAdministrativeApplication).toHaveBeenCalledWith({
      key: application.key,
      name: application.name,
      description: null,
      launchPath: application.launchPath,
      displayOrder: 0,
      actorUserId: actorUser.id,
    });
  });

  it('mantiene la clave fuera de los campos editables', async () => {
    applicationsService.updateAdministrativeApplication.mockResolvedValue(application);

    await controller.updateApplication(application.id, { name: 'Nuevo nombre' }, request);

    expect(applicationsService.updateAdministrativeApplication).toHaveBeenCalledWith({
      applicationId: application.id,
      name: 'Nuevo nombre',
      actorUserId: actorUser.id,
    });
  });
});
