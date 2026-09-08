import type { User } from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import type { PlatformBootstrapService } from './platform-bootstrap.service';
import { PlatformBootstrapController } from './platform-bootstrap.controller';

const authenticatedUser = { id: 'user-a' } as User;
const request = { authenticatedUser } as AuthenticatedRequest;

describe('PlatformBootstrapController', () => {
  const platformBootstrapService = { bootstrap: jest.fn() };
  const controller = new PlatformBootstrapController(
    platformBootstrapService as unknown as PlatformBootstrapService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('devuelve la sesión y las aplicaciones autorizadas del usuario autenticado', async () => {
    platformBootstrapService.bootstrap.mockResolvedValue({
      session: {
        id: authenticatedUser.id,
        corporateEmail: 'persona@timbo.com',
        displayName: 'Persona Timbo',
        isPlatformAdministrator: false,
      },
      applications: [
        {
          key: 'hello-world',
          name: 'Hello World',
          description: null,
          launchPath: '/apps/hello-world',
          displayOrder: 0,
        },
      ],
    });

    await expect(controller.getBootstrap(request)).resolves.toMatchObject({
      session: { id: authenticatedUser.id },
      applications: [{ key: 'hello-world' }],
    });
    expect(platformBootstrapService.bootstrap).toHaveBeenCalledWith(authenticatedUser);
  });

  it('falla explícitamente si el guard no adjuntó el usuario', async () => {
    await expect(controller.getBootstrap({} as AuthenticatedRequest)).rejects.toThrow(
      'El guard de sesión no adjuntó un usuario autenticado.',
    );
    expect(platformBootstrapService.bootstrap).not.toHaveBeenCalled();
  });
});
