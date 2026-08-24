import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import { ApplicationAccessService } from './application-access.service';
import { AdministrativeApplicationAccessController } from './administrative-application-access.controller';

describe('AdministrativeApplicationAccessController', () => {
  const service = {
    assignApplication: jest.fn(),
    unassignApplication: jest.fn(),
    listUserApplicationAccesses: jest.fn(),
    assignProfile: jest.fn(),
    addPermission: jest.fn(),
  };
  const controller = new AdministrativeApplicationAccessController(
    service as unknown as ApplicationAccessService,
  );
  const request = { authenticatedUser: { id: 'actor-a' } } as AuthenticatedRequest;
  beforeEach(() => jest.clearAllMocks());
  it('deriva actor exclusivamente de la sesión para mutaciones', async () => {
    await controller.assignApplication('user-a', 'app-a', request);
    await controller.assignProfile('user-a', 'profile-a', request);
    expect(service.assignApplication).toHaveBeenCalledWith('actor-a', 'user-a', 'app-a');
    expect(service.assignProfile).toHaveBeenCalledWith('actor-a', 'user-a', 'profile-a');
  });
  it('delega el listado y serializa el shape estable', async () => {
    service.listUserApplicationAccesses.mockResolvedValue([
      {
        applicationId: 'app-a',
        assignedAt: new Date('2026-08-25T00:00:00.000Z'),
        profileIds: ['profile-a'],
      },
    ]);
    await expect(controller.listUserAccesses('user-a')).resolves.toEqual([
      { applicationId: 'app-a', assignedAt: '2026-08-25T00:00:00.000Z', profileIds: ['profile-a'] },
    ]);
    expect(service.listUserApplicationAccesses).toHaveBeenCalledWith('user-a');
  });
});
