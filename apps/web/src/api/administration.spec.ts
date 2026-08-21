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
});
