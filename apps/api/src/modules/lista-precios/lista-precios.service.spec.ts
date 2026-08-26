import { ListaPreciosProviderUnavailableError } from './lista-precios.errors';
import { ListaPreciosService } from './lista-precios.service';

const ZOHO_OAUTH_TOKEN_ENDPOINT = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_VIEW_ENDPOINT =
  'https://analyticsapi.zoho.com/restapi/v2/workspaces/2400409000000791460/views/2400409000025208315/data';

const SAMPLE_CSV = 'Marca,Modelo,Stock\r\nSinotruk,Howo,ST-001\r\n';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/csv' } });
}

describe('ListaPreciosService', () => {
  const originalEnvironment = {
    ZOHO_ORG_ID: process.env.ZOHO_ORG_ID,
    ZOHO_WORKSPACE_ID: process.env.ZOHO_WORKSPACE_ID,
    ZOHO_VIEW_ID: process.env.ZOHO_VIEW_ID,
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
  };

  beforeEach(() => {
    process.env.ZOHO_ORG_ID = '748410058';
    process.env.ZOHO_WORKSPACE_ID = '2400409000000791460';
    process.env.ZOHO_VIEW_ID = '2400409000025208315';
    process.env.ZOHO_CLIENT_ID = 'test-client-id';
    process.env.ZOHO_CLIENT_SECRET = 'test-client-secret';
    process.env.ZOHO_REFRESH_TOKEN = 'test-refresh-token';
  });

  afterAll(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  });

  const createFetchMock = () => jest.fn() as jest.MockedFunction<typeof fetch>;

  it('refresca el token la primera vez y devuelve las filas del CSV parseadas', async () => {
    const fetchImplementation = createFetchMock();
    fetchImplementation
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh-token' }))
      .mockResolvedValueOnce(textResponse(SAMPLE_CSV));

    const service = new ListaPreciosService(fetchImplementation);

    await expect(service.getVehicles()).resolves.toEqual([
      { marca: 'Sinotruk', modelo: 'Howo', stock: 'ST-001' },
    ]);

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(ZOHO_OAUTH_TOKEN_ENDPOINT);
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(ZOHO_VIEW_ENDPOINT);
    const viewRequestInit = fetchImplementation.mock.calls[1]?.[1];
    expect(viewRequestInit?.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Zoho-oauthtoken fresh-token',
        'ZANALYTICS-ORGID': '748410058',
      }),
    );
  });

  it('reintenta un refresh si la vista responde 401 con el token actual', async () => {
    const fetchImplementation = createFetchMock();
    fetchImplementation
      .mockResolvedValueOnce(jsonResponse({ access_token: 'stale-token' }))
      .mockResolvedValueOnce(textResponse('', 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'renewed-token' }))
      .mockResolvedValueOnce(textResponse(SAMPLE_CSV));

    const service = new ListaPreciosService(fetchImplementation);

    await expect(service.getVehicles()).resolves.toHaveLength(1);
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
    const secondViewRequestInit = fetchImplementation.mock.calls[3]?.[1];
    expect(secondViewRequestInit?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Zoho-oauthtoken renewed-token' }),
    );
  });

  it('no reintenta y falla explícitamente ante un error distinto de 401', async () => {
    const fetchImplementation = createFetchMock();
    fetchImplementation
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh-token' }))
      .mockResolvedValueOnce(textResponse('internal error', 500));

    const service = new ListaPreciosService(fetchImplementation);

    await expect(service.getVehicles()).rejects.toBeInstanceOf(
      ListaPreciosProviderUnavailableError,
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('envuelve un fallo de red al pedir la vista', async () => {
    const fetchImplementation = createFetchMock();
    const networkError = new Error('network unavailable');
    fetchImplementation
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh-token' }))
      .mockRejectedValueOnce(networkError);

    const service = new ListaPreciosService(fetchImplementation);

    await expect(service.getVehicles()).rejects.toEqual(
      expect.objectContaining({
        name: 'ListaPreciosProviderUnavailableError',
        cause: networkError,
      }),
    );
  });

  it('envuelve un fallo de red al refrescar el token', async () => {
    const fetchImplementation = createFetchMock();
    const networkError = new Error('oauth endpoint unreachable');
    fetchImplementation.mockRejectedValueOnce(networkError);

    const service = new ListaPreciosService(fetchImplementation);

    await expect(service.getVehicles()).rejects.toEqual(
      expect.objectContaining({
        name: 'ListaPreciosProviderUnavailableError',
        cause: networkError,
      }),
    );
  });

  it('falla explícitamente si Zoho no devuelve un access_token válido al refrescar', async () => {
    const fetchImplementation = createFetchMock();
    fetchImplementation.mockResolvedValueOnce(jsonResponse({ error: 'invalid_code' }));

    const service = new ListaPreciosService(fetchImplementation);

    await expect(service.getVehicles()).rejects.toBeInstanceOf(
      ListaPreciosProviderUnavailableError,
    );
  });

  it('descarta filas completamente vacías del CSV', async () => {
    const fetchImplementation = createFetchMock();
    fetchImplementation
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh-token' }))
      .mockResolvedValueOnce(textResponse('Marca,Modelo,Stock\r\n,,\r\nSinotruk,Howo,ST-001\r\n'));

    const service = new ListaPreciosService(fetchImplementation);

    await expect(service.getVehicles()).resolves.toEqual([
      { marca: 'Sinotruk', modelo: 'Howo', stock: 'ST-001' },
    ]);
  });
});
