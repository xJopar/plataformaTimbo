import { MetaCompanyServiceLayerService } from './meta-company-service-layer.service';

const originalEnvironment = {
  baseUrl: process.env.META_COMPANY_SERVICE_LAYER_BASE_URL,
  username: process.env.META_COMPANY_SERVICE_LAYER_USERNAME,
  password: process.env.META_COMPANY_SERVICE_LAYER_PASSWORD,
  domain: process.env.META_COMPANY_SERVICE_LAYER_DOMAIN,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MetaCompanyServiceLayerService', () => {
  beforeEach(() => {
    process.env.META_COMPANY_SERVICE_LAYER_BASE_URL = 'http://service-layer.test/public';
    process.env.META_COMPANY_SERVICE_LAYER_USERNAME = 'service-user';
    process.env.META_COMPANY_SERVICE_LAYER_PASSWORD = 'service-password';
    process.env.META_COMPANY_SERVICE_LAYER_DOMAIN = 'meta-company';
  });

  afterAll(() => {
    restoreEnvironment('META_COMPANY_SERVICE_LAYER_BASE_URL', originalEnvironment.baseUrl);
    restoreEnvironment('META_COMPANY_SERVICE_LAYER_USERNAME', originalEnvironment.username);
    restoreEnvironment('META_COMPANY_SERVICE_LAYER_PASSWORD', originalEnvironment.password);
    restoreEnvironment('META_COMPANY_SERVICE_LAYER_DOMAIN', originalEnvironment.domain);
  });

  it('inicia sesion y verifica el asesor con un bearer token', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          data: {
            token: 'access-token',
            expiresIn: 1_800,
            refreshToken: 'refresh-token',
            refreshTokenExpiresIn: 28_800,
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        response({ data: { existe: true, SlpName: 'Carlos Carranza' }, error: null }),
      );
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await expect(service.verifySapAdvisor(2)).resolves.toBe(true);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      'http://service-layer.test/public/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'service-user',
          password: 'service-password',
          domain: 'meta-company',
        }),
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      'http://service-layer.test/public/asesores/verificar-sap',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ SlpCode: 2 }),
      }),
    );
  });

  it('expone el resultado inexistente sin intentar persistirlo', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          data: {
            token: 'access-token',
            expiresIn: 1_800,
            refreshToken: 'refresh-token',
            refreshTokenExpiresIn: 28_800,
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        response({ data: { existe: false, nombre: null, SlpCode: 999 }, error: null }),
      );
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await expect(service.verifySapAdvisor(999)).resolves.toBe(false);
  });

  it('renueva el token con el refresh token antes de iniciar sesion nuevamente', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          data: {
            token: 'first-access-token',
            expiresIn: 1,
            refreshToken: 'first-refresh-token',
            refreshTokenExpiresIn: 28_800,
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(response({ data: { existe: true }, error: null }))
      .mockResolvedValueOnce(
        response({
          data: {
            token: 'refreshed-access-token',
            expiresIn: 1_800,
            refreshToken: 'rotated-refresh-token',
            refreshTokenExpiresIn: 28_800,
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(response({ data: { existe: true }, error: null }));
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await expect(service.verifySapAdvisor(2)).resolves.toBe(true);
    await expect(service.verifySapAdvisor(3)).resolves.toBe(true);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      'http://service-layer.test/public/auth/refresh?refreshToken=first-refresh-token',
      expect.any(Object),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      4,
      'http://service-layer.test/public/asesores/verificar-sap',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer refreshed-access-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}
