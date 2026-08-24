import { describe, expect, it, vi } from 'vitest';
import { createAdministrationApi } from './administration';
import { ApiHttpError } from './system';

describe('createAdministrationApi', () => {
  it('envía cookies, búsqueda y protección CSRF al administrar usuarios', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const administrationApi = createAdministrationApi('http://localhost:3000', fetchImplementation);

    await expect(administrationApi.listUsers('persona@timbo.com')).resolves.toEqual([]);
    await expect(administrationApi.deactivateUser('user-a')).resolves.toBeUndefined();

    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:3000/api/admin/users?search=persona%40timbo.com',
    });
    expect(fetchImplementation.mock.calls[1]?.[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:3000/api/admin/users/user-a/deactivate',
    });
    expect(fetchImplementation.mock.calls[1]?.[0]).toHaveProperty('headers');
  });

  it('preserva un rechazo de autorización como ApiHttpError', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 403 }));
    const administrationApi = createAdministrationApi('http://localhost:3000', fetchImplementation);

    await expect(administrationApi.listUsers()).rejects.toEqual(expect.any(ApiHttpError));
  });

  it('usa rutas internas tipadas y CSRF al administrar aplicaciones', async () => {
    const application = {
      id: 'application-a',
      key: 'hello-world',
      name: 'Hello World',
      description: null,
      launchPath: '/apps/hello-world',
      status: 'ACTIVE' as const,
      displayOrder: 0,
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      deactivatedAt: null,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([application]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(application), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const administrationApi = createAdministrationApi('http://localhost:3000', fetchImplementation);

    await expect(administrationApi.listApplications()).resolves.toEqual([application]);
    await administrationApi.createApplication({
      key: application.key,
      name: application.name,
      description: null,
      launchPath: application.launchPath,
      displayOrder: 0,
    });

    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:3000/api/admin/applications',
    });
    expect(fetchImplementation.mock.calls[1]?.[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:3000/api/admin/applications',
    });
    expect(fetchImplementation.mock.calls[1]?.[0]).toHaveProperty('headers');
  });

  it('gestiona asignaciones, perfiles y permisos mediante las rutas administrativas tipadas', async () => {
    const profile = {
      id: 'profile-a',
      key: 'consulta',
      name: 'Consulta',
      description: null,
      status: 'ACTIVE' as const,
      permissionIds: [],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([profile]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(profile), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const administrationApi = createAdministrationApi('http://localhost:3000', fetchImplementation);

    await administrationApi.assignApplicationToUser('user-a', 'application-a');
    await expect(administrationApi.listApplicationProfiles('application-a')).resolves.toEqual([
      profile,
    ]);
    await administrationApi.createApplicationProfile('application-a', {
      key: 'consulta',
      name: 'Consulta',
      description: null,
    });
    await administrationApi.addPermissionToApplicationProfile('profile-a', 'permission-a');

    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:3000/api/admin/users/user-a/applications/application-a',
    });
    expect(fetchImplementation.mock.calls[1]?.[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:3000/api/admin/applications/application-a/profiles',
    });
    expect(fetchImplementation.mock.calls[2]?.[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:3000/api/admin/applications/application-a/profiles',
    });
    expect(fetchImplementation.mock.calls[3]?.[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:3000/api/admin/application-profiles/profile-a/permissions/permission-a',
    });
    expect(fetchImplementation.mock.calls[0]?.[0]).toHaveProperty('headers');
    expect(fetchImplementation.mock.calls[2]?.[0]).toHaveProperty('headers');
  });
});
