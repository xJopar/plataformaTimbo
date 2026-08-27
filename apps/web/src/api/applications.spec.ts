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

  const sampleVehicle = {
    marca: 'Sinotruk',
    modelo: 'Howo',
    anioFab: '2024',
    config: '6x4',
    susp: 'Neumática',
    tipoMotor: 'Diésel',
    tipoCabina: 'Larga',
    tipoCaja: 'Manual',
    aire: 'SI',
    color: 'Blanco',
    km: '0',
    precioLista: '70.300',
    ubicacion: 'Asunción',
    fechaSena: '',
    vendedorSena: '',
    uComentario: '',
    disponible: 'SI',
    tipoUnidad: 'Tracto',
    uso: 'Vial',
    inyeccion: 'Common Rail',
    altura: '',
    piso: '',
    tipo: 'Tracto',
    chasis: '',
    url: '',
    codGrupo: '',
    comentario: '',
    origen: 'Importado',
    kmOrigen: '',
    fechaEntradaTaller: '',
    fechaSalidaTaller: '',
    equipamiento: '',
    laterales: '',
    diasTranscurridos: '',
    ubicacion1: '',
    aproxLlegada: '',
    disponible1: '',
    stock: 'ST-001',
  };

  it('consulta el catálogo de vehículos de Lista de Precios incluyendo credenciales', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([sampleVehicle]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      createApplicationsApi(
        'http://localhost:3000',
        fetchImplementation,
      ).listListaPreciosVehicles(),
    ).resolves.toEqual([sampleVehicle]);
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({
      credentials: 'include',
      method: 'GET',
    });
    const request = fetchImplementation.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new Error('El cliente OpenAPI no construyó la petición esperada.');
    }
    expect(request.url).toContain('/api/applications/lista-precios/vehicles');
  });

  it('expone la indisponibilidad HTTP del catálogo de Lista de Precios', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 502,
        headers: { 'x-request-id': 'request-vehicles-502' },
      }),
    );

    await expect(
      createApplicationsApi(
        'http://localhost:3000',
        fetchImplementation,
      ).listListaPreciosVehicles(),
    ).rejects.toMatchObject({ status: 502, requestId: 'request-vehicles-502' });
  });

  it('tipa una falla de red al consultar el catálogo de Lista de Precios', async () => {
    const networkError = new TypeError('Failed to fetch');
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(networkError);

    await expect(
      createApplicationsApi(
        'http://localhost:3000',
        fetchImplementation,
      ).listListaPreciosVehicles(),
    ).rejects.toMatchObject({
      name: 'ApplicationsApiUnavailableError',
      code: 'APPLICATIONS_API_UNAVAILABLE',
      operation: 'listListaPreciosVehicles',
      cause: networkError,
    } satisfies Partial<ApplicationsApiUnavailableError>);
  });

  it('registra un hito de Lista de Precios con CSRF y credenciales', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      createApplicationsApi(
        'http://localhost:3000',
        fetchImplementation,
      ).recordListaPreciosUsageEvent({
        eventId: '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc',
        visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
        eventName: 'lista-precios.model_viewed',
        brand: 'FACCHINI',
        model: 'GRANELERO',
      }),
    ).resolves.toBeUndefined();

    const request = fetchImplementation.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new Error('El cliente OpenAPI no construyó la petición esperada.');
    }
    expect(request).toMatchObject({ credentials: 'include', method: 'POST' });
    expect(request.url).toContain('/api/applications/lista-precios/usage-events');
    expect(request.headers.get('x-timbo-csrf')).toBe('1');
  });
});
