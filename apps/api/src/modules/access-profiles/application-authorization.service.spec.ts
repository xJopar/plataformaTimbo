import { ApplicationAuthorizationService } from './application-authorization.service';

describe('ApplicationAuthorizationService', () => {
  const userApplicationAssignment = { count: jest.fn<Promise<number>, [unknown]>() };
  const userProfileAssignment = { count: jest.fn<Promise<number>, [unknown]>() };
  const service = new ApplicationAuthorizationService({
    userApplicationAssignment,
    userProfileAssignment,
  } as never);

  beforeEach(() => jest.resetAllMocks());

  it('autoriza el acceso sólo por una asignación de usuario, aplicación y usuario activos', async () => {
    userApplicationAssignment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(service.hasApplicationAccess('user-id', 'hello-world')).resolves.toBe(true);
    await expect(service.hasApplicationAccess('user-id', 'hello-world')).resolves.toBe(false);
    expect(userApplicationAssignment.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        user: { status: 'ACTIVE' },
        application: { key: 'hello-world', status: 'ACTIVE' },
      },
    });
  });

  it('no concede permisos funcionales por PLATFORM_ADMIN ni por acceso sin perfil', async () => {
    userProfileAssignment.count.mockResolvedValue(0);
    await expect(
      service.hasApplicationPermission('admin-id', 'hello-world', 'prices.view'),
    ).resolves.toBe(false);
    expect(userProfileAssignment.count).toHaveBeenCalledTimes(1);
  });

  it('requiere usuario, aplicación, asignación, perfil y permiso activos', async () => {
    userProfileAssignment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(
      service.hasApplicationPermission('user-id', 'hello-world', 'prices.view'),
    ).resolves.toBe(true);
    await expect(
      service.hasApplicationPermission('user-id', 'hello-world', 'prices.view'),
    ).resolves.toBe(false);
    expect(userProfileAssignment.count).toHaveBeenLastCalledWith({
      where: {
        userId: 'user-id',
        user: {
          status: 'ACTIVE',
          applicationAssignments: {
            some: { application: { key: 'hello-world', status: 'ACTIVE' } },
          },
        },
        profile: {
          scope: 'APPLICATION',
          status: 'ACTIVE',
          application: { key: 'hello-world', status: 'ACTIVE' },
          permissions: { some: { permission: { key: 'prices.view', status: 'ACTIVE' } } },
        },
      },
    });
  });
});
