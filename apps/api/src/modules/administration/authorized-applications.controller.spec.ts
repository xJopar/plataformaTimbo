import type { User } from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import type { ApplicationsService, AuthorizedApplication } from './applications.service';
import { AuthorizedApplicationsController } from './authorized-applications.controller';

const authenticatedUser = { id: 'user-a' } as User;
const request = { authenticatedUser } as AuthenticatedRequest;
const application: AuthorizedApplication = {
  key: 'hello-world',
  name: 'Hello World',
  description: 'Primera aplicación de Plataforma Timbo.',
  launchPath: '/apps/hello-world',
  displayOrder: 0,
};

describe('AuthorizedApplicationsController', () => {
  const applicationsService = {
    listAuthorizedApplications: jest.fn(),
  };
  const controller = new AuthorizedApplicationsController(
    applicationsService as unknown as ApplicationsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('lista las aplicaciones autorizadas para el usuario de la sesión', async () => {
    applicationsService.listAuthorizedApplications.mockResolvedValue([application]);

    await expect(controller.listApplications(request)).resolves.toEqual([application]);
    expect(applicationsService.listAuthorizedApplications).toHaveBeenCalledWith(
      authenticatedUser.id,
    );
  });

  it('falla explícitamente si el guard no adjuntó el usuario', async () => {
    await expect(controller.listApplications({} as AuthenticatedRequest)).rejects.toThrow(
      'El guard de sesión no adjuntó un usuario autenticado.',
    );
    expect(applicationsService.listAuthorizedApplications).not.toHaveBeenCalled();
  });
});
