import type { User } from '../../generated/prisma/client';
import type { AuthService } from '../auth/auth.service';
import type { ApplicationsService } from '../administration/applications.service';
import { PlatformBootstrapService } from './platform-bootstrap.service';

const authenticatedUser = { id: 'user-a' } as User;

describe('PlatformBootstrapService', () => {
  const authService = { toAuthenticatedIdentity: jest.fn() };
  const applicationsService = { listAuthorizedApplications: jest.fn() };
  const service = new PlatformBootstrapService(
    authService as unknown as AuthService,
    applicationsService as unknown as ApplicationsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('resuelve en paralelo la identidad y las aplicaciones autorizadas', async () => {
    let resolveIdentity: ((value: unknown) => void) | undefined;
    let resolveApplications: ((value: unknown) => void) | undefined;
    authService.toAuthenticatedIdentity.mockImplementation(
      () => new Promise((resolve) => (resolveIdentity = resolve)),
    );
    applicationsService.listAuthorizedApplications.mockImplementation(
      () => new Promise((resolve) => (resolveApplications = resolve)),
    );

    const bootstrap = service.bootstrap(authenticatedUser);
    expect(authService.toAuthenticatedIdentity).toHaveBeenCalledWith(authenticatedUser);
    expect(applicationsService.listAuthorizedApplications).toHaveBeenCalledWith(
      authenticatedUser.id,
    );

    resolveIdentity?.({ id: authenticatedUser.id, isPlatformAdministrator: false });
    resolveApplications?.([]);
    await expect(bootstrap).resolves.toEqual({
      session: { id: authenticatedUser.id, isPlatformAdministrator: false },
      applications: [],
    });
  });

  it('propaga una falla inesperada de las proyecciones', async () => {
    const failure = new Error('base no disponible');
    authService.toAuthenticatedIdentity.mockRejectedValue(failure);
    applicationsService.listAuthorizedApplications.mockResolvedValue([]);

    await expect(service.bootstrap(authenticatedUser)).rejects.toThrow(failure);
  });
});
