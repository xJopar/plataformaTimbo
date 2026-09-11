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
      .mockResolvedValueOnce(response({ data: { exists: true, hasName: true }, error: null }));
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
      .mockResolvedValueOnce(response({ data: { exists: false, hasName: false }, error: null }));
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await expect(service.verifySapAdvisor(999)).resolves.toBe(false);
  });

  it('consulta las empresas por el endpoint de listado de Service Layer', async () => {
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
        response({
          data: [{ id_empresa: 1, codigo: 'TIMBO', empresa: 'Timbo', activo: true }],
          error: null,
        }),
      );
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await expect(service.listEmpresas(false)).resolves.toEqual([
      { idEmpresa: 1, codigo: 'TIMBO', empresa: 'Timbo', activo: true },
    ]);
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      'http://service-layer.test/public/empresas/listar',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ activo: true }),
      }),
    );
  });

  it('identifica la respuesta de metas que contiene una marca invalida', async () => {
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
        response({
          data: [
            {
              id_meta_marca: 1,
              periodo: 202601,
              id_negocio: 5,
              id_marca: 0,
              meta: '1.00',
              dias_habiles: 22,
            },
          ],
          error: null,
        }),
      );
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await expect(service.listBrandGoals(5, 2026)).rejects.toThrow(
      'Service Layer devolvio el campo id_marca con un formato invalido al procesar metas-marca.',
    );
  });

  it('actualiza un asesor con POST y su identificador de Service Layer', async () => {
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
        response({
          data: {
            id_asesor: 45,
            id_empresa: 1,
            slp_code: 152,
            asesor: 'Luis Reguera',
            tipo: 'PERSON',
            activo: true,
          },
          error: null,
        }),
      );
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await expect(
      service.updateAdvisor(45, {
        empresaId: 1,
        idSap: 152,
        nombre: 'Luis Reguera',
        tipo: 'PERSON',
      }),
    ).resolves.toEqual({
      idAsesor: 45,
      idEmpresa: 1,
      idSap: 152,
      nombre: 'Luis Reguera',
      tipo: 'PERSON',
      activo: true,
    });
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      'http://service-layer.test/public/asesores',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id_asesor: 45,
          id_empresa: 1,
          slp_code: 152,
          asesor: 'Luis Reguera',
          tipo: 'PERSON',
        }),
      }),
    );
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
      .mockResolvedValueOnce(response({ data: { exists: true }, error: null }))
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
      .mockResolvedValueOnce(response({ data: { exists: true }, error: null }));
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

  it('actualiza metas por marca y asesor con POST y sus identificadores', async () => {
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
        response({
          data: {
            id_meta_marca: 1,
            periodo: 202601,
            id_negocio: 5,
            id_marca: 27,
            meta: '1.00',
            dias_habiles: 22,
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        response({
          data: {
            id_meta_asesor: 45,
            periodo: 202601,
            id_negocio: 3,
            id_marca: null,
            id_asesor: 45,
            meta: '291419.00',
            dias_habiles: null,
          },
          error: null,
        }),
      );
    const service = new MetaCompanyServiceLayerService(fetchImplementation);

    await service.updateBrandGoal(1, '1.00', 22);
    await service.updateAdvisorGoal(45, '291419.00', undefined);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      'http://service-layer.test/public/metas-marca',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id_meta_marca: 1, meta: '1.00', dias_habiles: 22 }),
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      'http://service-layer.test/public/metas-asesor',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id_meta_asesor: 45, meta: '291419.00' }),
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
