import { BadRequestException } from '@nestjs/common';
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
    assignApplicationToUsers: jest.fn(),
    unassignApplicationFromUsers: jest.fn(),
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
  it('delega la asignación y desasignación en lote, derivando el actor de la sesión', async () => {
    service.assignApplicationToUsers.mockResolvedValue([{ userId: 'user-a', status: 'ASSIGNED' }]);
    service.unassignApplicationFromUsers.mockResolvedValue([
      { userId: 'user-a', status: 'UNASSIGNED' },
    ]);

    await expect(
      controller.assignApplicationBulk('app-a', { userIds: ['user-a'] }, request),
    ).resolves.toEqual([{ userId: 'user-a', status: 'ASSIGNED' }]);
    expect(service.assignApplicationToUsers).toHaveBeenCalledWith('actor-a', 'app-a', ['user-a']);

    await expect(
      controller.unassignApplicationBulk('app-a', { userIds: ['user-a'] }, request),
    ).resolves.toEqual([{ userId: 'user-a', status: 'UNASSIGNED' }]);
    expect(service.unassignApplicationFromUsers).toHaveBeenCalledWith('actor-a', 'app-a', [
      'user-a',
    ]);
  });
  it('rechaza una lista de usuarios vacía o excesiva en operaciones en lote', async () => {
    await expect(
      controller.assignApplicationBulk('app-a', { userIds: [] }, request),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.unassignApplicationBulk(
        'app-a',
        { userIds: Array.from({ length: 501 }, (_, index) => `user-${index.toString()}`) },
        request,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.assignApplicationToUsers).not.toHaveBeenCalled();
    expect(service.unassignApplicationFromUsers).not.toHaveBeenCalled();
  });
});
