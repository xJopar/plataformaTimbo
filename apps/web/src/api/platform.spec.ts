import { describe, expect, it, vi } from 'vitest';
import { createPlatformApi, PlatformApiUnavailableError } from './platform';
import { ApiHttpError } from './system';

describe('createPlatformApi', () => {
  it('obtiene sesión y aplicaciones con las credenciales de la sesión', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          session: {
            id: 'user-a',
            corporateEmail: 'persona@timbo.com',
            displayName: 'Persona Timbo',
            isPlatformAdministrator: false,
          },
          applications: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      createPlatformApi('http://localhost:3000', fetchImplementation).getBootstrap(),
    ).resolves.toMatchObject({ session: { id: 'user-a' }, applications: [] });
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({ credentials: 'include' });
  });

  it('conserva el request id de una respuesta HTTP fallida', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 503, headers: { 'x-request-id': 'bootstrap-1' } }),
      );

    await expect(
      createPlatformApi('http://localhost:3000', fetchImplementation).getBootstrap(),
    ).rejects.toEqual(new ApiHttpError(503, 'bootstrap-1'));
  });

  it('expone una falla de red recuperable sin ocultar la causa', async () => {
    const networkError = new TypeError('Failed to fetch');
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(networkError);

    await expect(
      createPlatformApi('http://localhost:3000', fetchImplementation).getBootstrap(),
    ).rejects.toMatchObject({
      name: 'PlatformApiUnavailableError',
      operation: 'getBootstrap',
      cause: networkError,
    } satisfies Partial<PlatformApiUnavailableError>);
  });
});
