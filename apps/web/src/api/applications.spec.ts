import { describe, expect, it, vi } from 'vitest';
import { createApplicationsApi } from './applications';
import { ApiHttpError } from './system';

describe('createApplicationsApi', () => {
  it('consulta las aplicaciones autorizadas incluyendo credenciales', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            key: 'hello-world',
            name: 'Hello World',
            description: 'Primera aplicación de Plataforma Timbo.',
            launchPath: '/apps/hello-world',
            displayOrder: 0,
          },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await expect(
      createApplicationsApi(
        'http://localhost:3000',
        fetchImplementation,
      ).listAuthorizedApplications(),
    ).resolves.toHaveLength(1);
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({ credentials: 'include' });
  });

  it('expone el error HTTP del launcher', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      createApplicationsApi(
        'http://localhost:3000',
        fetchImplementation,
      ).listAuthorizedApplications(),
    ).rejects.toBeInstanceOf(ApiHttpError);
  });
});
