import { Inject, Injectable } from '@nestjs/common';
import {
  resolveMetaCompanyServiceLayerConfig,
  type MetaCompanyServiceLayerConfig,
} from './meta-company-service-layer.config';
import { MetaCompanyServiceLayerUnavailableError } from './meta-company-service-layer.errors';
import { META_COMPANY_SERVICE_LAYER_FETCH } from './meta-company-service-layer.tokens';

const PROVIDER_TIMEOUT_MILLISECONDS = 15_000;
const TOKEN_EXPIRATION_SAFETY_MILLISECONDS = 60_000;

type FetchImplementation = typeof fetch;
type ServiceLayerRecord = Record<string, unknown>;

interface ServiceLayerSession {
  token: string;
  tokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
}

export interface ServiceLayerEmpresa {
  idEmpresa: number;
  codigo: string;
  empresa: string;
  activo: boolean;
}
export interface ServiceLayerBrand {
  idMarca: number;
  codigo: string;
  marca: string;
  activo: boolean;
}
export interface ServiceLayerBusiness {
  idNegocio: number;
  idEmpresa: number;
  codigo: string;
  negocio: string;
  activo: boolean;
}
export interface ServiceLayerAdvisor {
  idAsesor: number;
  idEmpresa: number;
  idSap: number;
  nombre: string;
  tipo: 'PERSON' | 'SALES_CHANNEL';
  activo: boolean;
}
export interface ServiceLayerGoal {
  id: number;
  periodo: number;
  idNegocio: number;
  idMarca: number | null;
  idAsesor: number | null;
  meta: string;
  diasHabiles: number | null;
}

interface AdvisorInput {
  empresaId: number;
  idSap: number;
  nombre: string;
  tipo: 'PERSON' | 'SALES_CHANNEL';
}
interface BrandGoalInput {
  periodo: number;
  idNegocio: number;
  idMarca: number;
  meta: string;
  diasHabiles?: number;
}
interface AdvisorGoalInput {
  periodo: number;
  idNegocio: number;
  idMarca: number | null;
  idAsesor: number;
  meta: string;
  diasHabiles?: number;
}

class ServiceLayerRefreshRejectedError extends Error {
  public constructor() {
    super('Service Layer rechazo el refresh token.');
    this.name = 'ServiceLayerRefreshRejectedError';
  }
}

@Injectable()
export class MetaCompanyServiceLayerService {
  private session: ServiceLayerSession | undefined;
  private authenticationPromise: Promise<void> | undefined;

  public constructor(
    @Inject(META_COMPANY_SERVICE_LAYER_FETCH)
    private readonly fetchImplementation: FetchImplementation,
  ) {}

  public async verifySapAdvisor(salespersonCode: number): Promise<boolean> {
    const data = await this.requestRecord('POST', '/asesores/verificar-sap', {
      SlpCode: salespersonCode,
    });
    const exists = data.existe;
    if (typeof exists !== 'boolean') this.invalidResponse('verificar el asesor SAP');
    return exists;
  }

  public async listEmpresas(includeInactive: boolean): Promise<ServiceLayerEmpresa[]> {
    return this.requestList('empresas/listar', includeInactive ? {} : { activo: true }, mapEmpresa);
  }
  public async listBrands(includeInactive: boolean): Promise<ServiceLayerBrand[]> {
    return this.requestList('marcas/listar', includeInactive ? {} : { activo: true }, mapBrand);
  }
  public async listBusinesses(includeInactive: boolean): Promise<ServiceLayerBusiness[]> {
    return this.requestList(
      'negocios/listar',
      includeInactive ? {} : { activo: true },
      mapBusiness,
    );
  }
  public async listAdvisors(includeInactive: boolean): Promise<ServiceLayerAdvisor[]> {
    return this.requestList('asesores/listar', includeInactive ? {} : { activo: true }, mapAdvisor);
  }
  public async listBrandGoals(
    idNegocio: number,
    year: number | undefined,
  ): Promise<ServiceLayerGoal[]> {
    return this.requestList(
      'metas-marca/listar',
      { id_negocio: idNegocio, ...(year === undefined ? {} : { periodo: year }) },
      mapBrandGoal,
    );
  }
  public async listAdvisorGoals(
    idNegocio: number,
    year: number | undefined,
  ): Promise<ServiceLayerGoal[]> {
    return this.requestList(
      'metas-asesor/listar',
      { id_negocio: idNegocio, ...(year === undefined ? {} : { periodo: year }) },
      mapAdvisorGoal,
    );
  }

  public async createEmpresa(codigo: string, empresa: string): Promise<ServiceLayerEmpresa> {
    return mapEmpresa(await this.requestRecord('POST', '/empresas', { codigo, empresa }));
  }
  public async updateEmpresa(
    id: number,
    codigo: string,
    empresa: string,
  ): Promise<ServiceLayerEmpresa> {
    return mapEmpresa(
      await this.requestRecord('PATCH', `/empresas/${String(id)}`, { codigo, empresa }),
    );
  }
  public async setEmpresaActive(id: number, activo: boolean): Promise<ServiceLayerEmpresa> {
    return mapEmpresa(
      await this.requestRecord('PATCH', `/empresas/${String(id)}/activo`, { activo }),
    );
  }
  public async createBrand(codigo: string, marca: string): Promise<ServiceLayerBrand> {
    return mapBrand(await this.requestRecord('POST', '/marcas', { codigo, marca }));
  }
  public async updateBrand(id: number, codigo: string, marca: string): Promise<ServiceLayerBrand> {
    return mapBrand(await this.requestRecord('PATCH', `/marcas/${String(id)}`, { codigo, marca }));
  }
  public async setBrandActive(id: number, activo: boolean): Promise<ServiceLayerBrand> {
    return mapBrand(await this.requestRecord('PATCH', `/marcas/${String(id)}/activo`, { activo }));
  }
  public async createBusiness(
    idEmpresa: number,
    codigo: string,
    negocio: string,
  ): Promise<ServiceLayerBusiness> {
    return mapBusiness(
      await this.requestRecord('POST', '/negocios', { id_empresa: idEmpresa, codigo, negocio }),
    );
  }
  public async updateBusiness(
    id: number,
    idEmpresa: number,
    codigo: string,
    negocio: string,
  ): Promise<ServiceLayerBusiness> {
    return mapBusiness(
      await this.requestRecord('PATCH', `/negocios/${String(id)}`, {
        id_empresa: idEmpresa,
        codigo,
        negocio,
      }),
    );
  }
  public async setBusinessActive(id: number, activo: boolean): Promise<ServiceLayerBusiness> {
    return mapBusiness(
      await this.requestRecord('PATCH', `/negocios/${String(id)}/activo`, { activo }),
    );
  }
  public async createAdvisor(input: AdvisorInput): Promise<ServiceLayerAdvisor> {
    return mapAdvisor(
      await this.requestRecord('POST', '/asesores', {
        id_empresa: input.empresaId,
        id_sap: input.idSap,
        nombre: input.nombre,
        tipo: input.tipo,
      }),
    );
  }
  public async updateAdvisor(id: number, input: AdvisorInput): Promise<ServiceLayerAdvisor> {
    return mapAdvisor(
      await this.requestRecord('PATCH', `/asesores/${String(id)}`, {
        id_empresa: input.empresaId,
        id_sap: input.idSap,
        nombre: input.nombre,
        tipo: input.tipo,
      }),
    );
  }
  public async setAdvisorActive(id: number, activo: boolean): Promise<ServiceLayerAdvisor> {
    return mapAdvisor(
      await this.requestRecord('PATCH', `/asesores/${String(id)}/activo`, { activo }),
    );
  }
  public async createBrandGoal(input: BrandGoalInput): Promise<ServiceLayerGoal> {
    return mapBrandGoal(await this.requestRecord('POST', '/metas-marca', toBrandGoalBody(input)));
  }
  public async updateBrandGoal(
    id: number,
    meta: string,
    diasHabiles: number | undefined,
  ): Promise<ServiceLayerGoal> {
    return mapBrandGoal(
      await this.requestRecord('PATCH', `/metas-marca/${String(id)}`, {
        meta,
        ...(diasHabiles === undefined ? {} : { dias_habiles: diasHabiles }),
      }),
    );
  }
  public async createAdvisorGoal(input: AdvisorGoalInput): Promise<ServiceLayerGoal> {
    return mapAdvisorGoal(
      await this.requestRecord('POST', '/metas-asesor', toAdvisorGoalBody(input)),
    );
  }
  public async updateAdvisorGoal(
    id: number,
    meta: string,
    diasHabiles: number | undefined,
  ): Promise<ServiceLayerGoal> {
    return mapAdvisorGoal(
      await this.requestRecord('PATCH', `/metas-asesor/${String(id)}`, {
        meta,
        ...(diasHabiles === undefined ? {} : { dias_habiles: diasHabiles }),
      }),
    );
  }

  private async requestList<T>(
    path: string,
    body: ServiceLayerRecord,
    map: (value: ServiceLayerRecord) => T,
  ): Promise<T[]> {
    const data = await this.request('POST', `/${path}`, body);
    if (!Array.isArray(data)) this.invalidResponse(`listar ${path}`);
    return data.map((item) => map(asRecord(item, `listar ${path}`)));
  }

  private async requestRecord(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: ServiceLayerRecord,
  ): Promise<ServiceLayerRecord> {
    return asRecord(await this.request(method, path, body), `${method} ${path}`);
  }

  private async request(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: ServiceLayerRecord,
  ): Promise<ServiceLayerRecord | ServiceLayerRecord[]> {
    let response = await this.fetchAuthenticated(method, path, body);
    if (response.status === 401) {
      this.invalidateAccessToken();
      response = await this.fetchAuthenticated(method, path, body);
    }
    if (!response.ok) {
      throw new MetaCompanyServiceLayerUnavailableError(
        `Service Layer respondio con estado HTTP ${String(response.status)} al ejecutar ${method} ${path}.`,
      );
    }
    const parsed = await parseJsonResponse(response, `${method} ${path}`);
    const data = isRecord(parsed) ? parsed.data : undefined;
    if (Array.isArray(data)) return data.map((item) => asRecord(item, `${method} ${path}`));
    return asRecord(data, `${method} ${path}`);
  }

  private async fetchAuthenticated(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: ServiceLayerRecord,
  ): Promise<Response> {
    const config = resolveMetaCompanyServiceLayerConfig();
    const token = await this.getAccessToken(config);
    try {
      return await this.fetchImplementation(`${config.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw new MetaCompanyServiceLayerUnavailableError(
        `No fue posible conectar con Service Layer al ejecutar ${method} ${path}.`,
        error,
      );
    }
  }

  private async getAccessToken(config: MetaCompanyServiceLayerConfig): Promise<string> {
    if (this.hasValidAccessToken() && this.session !== undefined) return this.session.token;
    if (this.authenticationPromise !== undefined) {
      await this.authenticationPromise;
      if (this.session === undefined)
        throw new MetaCompanyServiceLayerUnavailableError(
          'Service Layer no devolvio una sesion valida.',
        );
      return this.session.token;
    }
    this.authenticationPromise = this.authenticate(config).finally(() => {
      this.authenticationPromise = undefined;
    });
    await this.authenticationPromise;
    if (this.session === undefined)
      throw new MetaCompanyServiceLayerUnavailableError(
        'Service Layer no devolvio una sesion valida.',
      );
    return this.session.token;
  }
  private async authenticate(config: MetaCompanyServiceLayerConfig): Promise<void> {
    if (this.hasValidRefreshToken() && this.session !== undefined) {
      try {
        this.session = await this.refreshSession(config, this.session.refreshToken);
        return;
      } catch (error) {
        if (!(error instanceof ServiceLayerRefreshRejectedError)) throw error;
        this.session = undefined;
      }
    }
    this.session = await this.login(config);
  }
  private async login(config: MetaCompanyServiceLayerConfig): Promise<ServiceLayerSession> {
    return parseSession(
      await this.fetchAuthenticationEndpoint(
        `${config.baseUrl}/auth/login`,
        { username: config.username, password: config.password, domain: config.domain },
        'iniciar sesion',
      ),
      'iniciar sesion',
    );
  }
  private async refreshSession(
    config: MetaCompanyServiceLayerConfig,
    refreshToken: string,
  ): Promise<ServiceLayerSession> {
    let response: Response;
    try {
      response = await this.fetchImplementation(
        `${config.baseUrl}/auth/refresh?${new URLSearchParams({ refreshToken }).toString()}`,
        { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS) },
      );
    } catch (error) {
      throw new MetaCompanyServiceLayerUnavailableError(
        'No fue posible conectar con Service Layer para renovar la sesion.',
        error,
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new ServiceLayerRefreshRejectedError();
    if (!response.ok)
      throw new MetaCompanyServiceLayerUnavailableError(
        `Service Layer respondio con estado HTTP ${String(response.status)} al renovar la sesion.`,
      );
    return parseSession(response, 'renovar la sesion');
  }
  private async fetchAuthenticationEndpoint(
    url: string,
    body: ServiceLayerRecord,
    operation: string,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw new MetaCompanyServiceLayerUnavailableError(
        `No fue posible conectar con Service Layer para ${operation}.`,
        error,
      );
    }
    if (!response.ok)
      throw new MetaCompanyServiceLayerUnavailableError(
        `Service Layer respondio con estado HTTP ${String(response.status)} al ${operation}.`,
      );
    return response;
  }
  private hasValidAccessToken(): boolean {
    return this.session !== undefined && Date.now() < this.session.tokenExpiresAt;
  }
  private hasValidRefreshToken(): boolean {
    return this.session !== undefined && Date.now() < this.session.refreshTokenExpiresAt;
  }
  private invalidateAccessToken(): void {
    if (this.session !== undefined) this.session.tokenExpiresAt = 0;
  }
  private invalidResponse(operation: string): never {
    throw new MetaCompanyServiceLayerUnavailableError(
      `Service Layer devolvio una respuesta invalida al ${operation}.`,
    );
  }
}

function toBrandGoalBody(input: BrandGoalInput): ServiceLayerRecord {
  return {
    periodo: input.periodo,
    id_negocio: input.idNegocio,
    id_marca: input.idMarca,
    meta: input.meta,
    ...(input.diasHabiles === undefined ? {} : { dias_habiles: input.diasHabiles }),
  };
}
function toAdvisorGoalBody(input: AdvisorGoalInput): ServiceLayerRecord {
  return {
    periodo: input.periodo,
    id_negocio: input.idNegocio,
    id_marca: input.idMarca,
    id_asesor: input.idAsesor,
    meta: input.meta,
    ...(input.diasHabiles === undefined ? {} : { dias_habiles: input.diasHabiles }),
  };
}
function mapEmpresa(value: ServiceLayerRecord): ServiceLayerEmpresa {
  return {
    idEmpresa: positiveInteger(value.id_empresa, 'id_empresa'),
    codigo: nonEmptyString(value.codigo, 'codigo'),
    empresa: nonEmptyString(value.empresa, 'empresa'),
    activo: booleanValue(value.activo, 'activo'),
  };
}
function mapBrand(value: ServiceLayerRecord): ServiceLayerBrand {
  return {
    idMarca: positiveInteger(value.id_marca, 'id_marca'),
    codigo: nonEmptyString(value.codigo, 'codigo'),
    marca: nonEmptyString(value.marca, 'marca'),
    activo: booleanValue(value.activo, 'activo'),
  };
}
function mapBusiness(value: ServiceLayerRecord): ServiceLayerBusiness {
  return {
    idNegocio: positiveInteger(value.id_negocio, 'id_negocio'),
    idEmpresa: positiveInteger(value.id_empresa, 'id_empresa'),
    codigo: nonEmptyString(value.codigo, 'codigo'),
    negocio: nonEmptyString(value.negocio, 'negocio'),
    activo: booleanValue(value.activo, 'activo'),
  };
}
function mapAdvisor(value: ServiceLayerRecord): ServiceLayerAdvisor {
  const tipo = value.tipo;
  if (tipo !== 'PERSON' && tipo !== 'SALES_CHANNEL') invalidField('tipo');
  return {
    idAsesor: positiveInteger(value.id_asesor, 'id_asesor'),
    idEmpresa: positiveInteger(value.id_empresa, 'id_empresa'),
    idSap: positiveInteger(value.id_sap, 'id_sap'),
    nombre: nonEmptyString(value.nombre, 'nombre'),
    tipo,
    activo: booleanValue(value.activo, 'activo'),
  };
}
function mapBrandGoal(value: ServiceLayerRecord): ServiceLayerGoal {
  return mapGoal(value, 'id_meta_marca', false);
}
function mapAdvisorGoal(value: ServiceLayerRecord): ServiceLayerGoal {
  return mapGoal(value, 'id_meta_asesor', true);
}
function mapGoal(
  value: ServiceLayerRecord,
  idField: string,
  requiresAdvisor: boolean,
): ServiceLayerGoal {
  const idMarca = nullablePositiveInteger(value.id_marca, 'id_marca');
  const idAsesor = nullablePositiveInteger(value.id_asesor, 'id_asesor');
  if (requiresAdvisor && idAsesor === null) invalidField('id_asesor');
  return {
    id: positiveInteger(value[idField], idField),
    periodo: positiveInteger(value.periodo, 'periodo'),
    idNegocio: positiveInteger(value.id_negocio, 'id_negocio'),
    idMarca,
    idAsesor,
    meta: nonEmptyString(value.meta, 'meta'),
    diasHabiles: nullablePositiveInteger(value.dias_habiles, 'dias_habiles'),
  };
}
async function parseSession(response: Response, operation: string): Promise<ServiceLayerSession> {
  const body = await parseJsonResponse(response, operation);
  const data = isRecord(body) ? dataRecord(body.data, operation) : undefined;
  const token = data?.token;
  const expiresIn = data?.expiresIn;
  const refreshToken = data?.refreshToken;
  const refreshTokenExpiresIn = data?.refreshTokenExpiresIn;
  if (
    typeof token !== 'string' ||
    token.trim() === '' ||
    !isPositiveFiniteNumber(expiresIn) ||
    typeof refreshToken !== 'string' ||
    refreshToken.trim() === '' ||
    !isPositiveFiniteNumber(refreshTokenExpiresIn)
  )
    throw new MetaCompanyServiceLayerUnavailableError(
      `Service Layer devolvio una sesion invalida al ${operation}.`,
    );
  return {
    token,
    tokenExpiresAt: expirationTimestamp(expiresIn),
    refreshToken,
    refreshTokenExpiresAt: expirationTimestamp(refreshTokenExpiresIn),
  };
}
async function parseJsonResponse(response: Response, operation: string): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new MetaCompanyServiceLayerUnavailableError(
      `Service Layer devolvio un formato invalido al ${operation}.`,
      error,
    );
  }
}
function asRecord(value: unknown, operation: string): ServiceLayerRecord {
  if (!isRecord(value))
    throw new MetaCompanyServiceLayerUnavailableError(
      `Service Layer devolvio una respuesta invalida al ${operation}.`,
    );
  return value;
}
function dataRecord(value: unknown, operation: string): ServiceLayerRecord | undefined {
  return value === undefined ? undefined : asRecord(value, operation);
}
function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) invalidField(field);
  return value;
}
function nullablePositiveInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return positiveInteger(value, field);
}
function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalidField(field);
  return value;
}
function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalidField(field);
  return value;
}
function invalidField(field: string): never {
  throw new MetaCompanyServiceLayerUnavailableError(
    `Service Layer devolvio el campo ${field} con un formato invalido.`,
  );
}
function expirationTimestamp(expiresInSeconds: number): number {
  return Date.now() + Math.max(0, expiresInSeconds * 1_000 - TOKEN_EXPIRATION_SAFETY_MILLISECONDS);
}
function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function isRecord(value: unknown): value is ServiceLayerRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
