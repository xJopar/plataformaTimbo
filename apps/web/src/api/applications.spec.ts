import { describe, expect, it, vi } from 'vitest';
import { ApplicationsApiUnavailableError, createApplicationsApi } from './applications';
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

  it('solicita el chiste y registra el clic incluyendo credenciales', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'joke-a',
          originalText: 'A short joke.',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await expect(
      createApplicationsApi('http://localhost:3000', fetchImplementation).requestHelloWorldJoke({
        eventId: '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc',
        visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
      }),
    ).resolves.toMatchObject({ id: 'joke-a' });
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({
      credentials: 'include',
      method: 'POST',
    });
    const request = fetchImplementation.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new Error('El cliente OpenAPI no construyó la petición esperada.');
    }
    expect(request.url).toContain('/api/applications/hello-world/joke');
  });

  it('expone la indisponibilidad HTTP del ejemplo Hello World', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 502,
        headers: { 'x-request-id': 'request-joke-502' },
      }),
    );

    await expect(
      createApplicationsApi('http://localhost:3000', fetchImplementation).requestHelloWorldJoke({
        eventId: '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc',
        visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
      }),
    ).rejects.toMatchObject({ status: 502, requestId: 'request-joke-502' });
  });

  it('tipa una falla de red sin ocultar su causa', async () => {
    const networkError = new TypeError('Failed to fetch');
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(networkError);

    await expect(
      createApplicationsApi('http://localhost:3000', fetchImplementation).requestHelloWorldJoke({
        eventId: '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc',
        visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
      }),
    ).rejects.toMatchObject({
      name: 'ApplicationsApiUnavailableError',
      code: 'APPLICATIONS_API_UNAVAILABLE',
      operation: 'requestHelloWorldJoke',
      cause: networkError,
    } satisfies Partial<ApplicationsApiUnavailableError>);
  });
});
