import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { createApiHttpError } from './system';

export type AuthorizedApplication = NonNullable<
  paths['/api/applications']['get']['responses'][200]['content']['application/json']
>[number];

export type HelloWorldJoke = NonNullable<
  paths['/api/applications/hello-world/joke']['post']['responses'][200]['content']['application/json']
>;

export type HelloWorldJokeRequest = NonNullable<
  paths['/api/applications/hello-world/joke']['post']['requestBody']['content']['application/json']
>;

export type VehicleResponse = NonNullable<
  paths['/api/applications/lista-precios/vehicles']['get']['responses'][200]['content']['application/json']
>[number];

export type ListaPreciosUsageEventName =
  | 'lista-precios.catalog_opened'
  | 'lista-precios.model_viewed'
  | 'lista-precios.consultation_started';

export interface ListaPreciosUsageEventRequest {
  eventId: string;
  visitId: string;
  eventName: ListaPreciosUsageEventName;
  brand?: string;
  model?: string;
}

export type FiveSIndicator = NonNullable<
  paths['/api/applications/seguimiento-5s/indicators']['get']['responses'][200]['content']['application/json']
>[number];

export type FiveSParticipant = NonNullable<
  paths['/api/applications/seguimiento-5s/participants']['get']['responses'][200]['content']['application/json']
>[number];

export type FiveSDailyEntries = NonNullable<
  paths['/api/applications/seguimiento-5s/entries']['get']['responses'][200]['content']['application/json']
>;

export type FiveSDashboardSummary = NonNullable<
  paths['/api/applications/seguimiento-5s/dashboard/summary']['get']['responses'][200]['content']['application/json']
>;

export type FiveSCapabilities = NonNullable<
  paths['/api/applications/seguimiento-5s/capabilities']['get']['responses'][200]['content']['application/json']
>;

export type FiveSRoleKey = NonNullable<FiveSParticipant['roleKey']>;
export type FiveSEntryValue = 'MET' | 'NOT_MET' | 'NOT_APPLICABLE';

export interface CreateFiveSIndicatorRequest {
  key: string;
  name: string;
  controlledSince: string;
  displayOrder?: number;
}

export interface UpdateFiveSIndicatorRequest {
  name?: string;
  controlledSince?: string;
  displayOrder?: number;
}

export interface SaveFiveSDailyEntriesRequest {
  entryDate: string;
  entries: { userId: string; indicatorId: string; value: FiveSEntryValue }[];
}

export interface MetaCompanyAdvisorRequest {
  empresaId: number;
  sourceSystem: string;
  externalCode: string;
  displayName: string;
  kind: 'PERSON' | 'SALES_CHANNEL';
}

export interface MetaCompanyCatalogItemRequest {
  empresaId: number;
  name: string;
}

export interface MetaCompanyBrandGoalRequest {
  period: string;
  businessId: number;
  brandId: number;
  value: string;
}

export interface MetaCompanyAdvisorGoalRequest {
  period: string;
  businessId: number;
  brandId?: number;
  advisorId: number;
  value: string;
  workingDays?: number;
}

export interface ApplicationsApi {
  listAuthorizedApplications(): Promise<AuthorizedApplication[]>;
  requestHelloWorldJoke(input: HelloWorldJokeRequest): Promise<HelloWorldJoke>;
  listListaPreciosVehicles(): Promise<VehicleResponse[]>;
  recordListaPreciosUsageEvent(input: ListaPreciosUsageEventRequest): Promise<void>;
  listMetaCompanyGoals(period: string, empresaId?: number): Promise<
    paths['/api/applications/meta-company/goals']['get']['responses'][200]['content']['application/json']
  >;
  listMetaCompanyCatalogs(): Promise<
    paths['/api/applications/meta-company/catalogs']['get']['responses'][200]['content']['application/json']
  >;
  listAllMetaCompanyCatalogs(): Promise<
    paths['/api/applications/meta-company/catalogs/all']['get']['responses'][200]['content']['application/json']
  >;
  getMetaCompanyCapabilities(): Promise<
    paths['/api/applications/meta-company/capabilities']['get']['responses'][200]['content']['application/json']
  >;
  createMetaCompanyBrandGoal(input: MetaCompanyBrandGoalRequest): Promise<
    paths['/api/applications/meta-company/brand-goals']['post']['responses'][201]['content']['application/json']
  >;
  createMetaCompanyAdvisorGoal(input: MetaCompanyAdvisorGoalRequest): Promise<
    paths['/api/applications/meta-company/advisor-goals']['post']['responses'][201]['content']['application/json']
  >;
  updateMetaCompanyBrandGoal(id: number, value: string): Promise<
    paths['/api/applications/meta-company/brand-goals/{id}']['patch']['responses'][200]['content']['application/json']
  >;
  updateMetaCompanyAdvisorGoal(id: number, value: string, workingDays?: number): Promise<
    paths['/api/applications/meta-company/advisor-goals/{id}']['patch']['responses'][200]['content']['application/json']
  >;
  createMetaCompanyBrand(input: MetaCompanyCatalogItemRequest): Promise<
    paths['/api/applications/meta-company/brands']['post']['responses'][201]['content']['application/json']
  >;
  createMetaCompanyBusiness(input: MetaCompanyCatalogItemRequest): Promise<
    paths['/api/applications/meta-company/businesses']['post']['responses'][201]['content']['application/json']
  >;
  createMetaCompanyAdvisor(input: MetaCompanyAdvisorRequest): Promise<
    paths['/api/applications/meta-company/advisors']['post']['responses'][201]['content']['application/json']
  >;
  updateMetaCompanyAdvisor(id: number, input: MetaCompanyAdvisorRequest): Promise<
    paths['/api/applications/meta-company/advisors/{id}']['patch']['responses'][200]['content']['application/json']
  >;
  setMetaCompanyAdvisorActive(id: number, active: boolean): Promise<
    paths['/api/applications/meta-company/advisors/{id}/active']['patch']['responses'][200]['content']['application/json']
  >;
  getSeguimiento5sCapabilities(): Promise<FiveSCapabilities>;
  listSeguimiento5sIndicators(includeInactive: boolean): Promise<FiveSIndicator[]>;
  createSeguimiento5sIndicator(input: CreateFiveSIndicatorRequest): Promise<FiveSIndicator>;
  updateSeguimiento5sIndicator(
    id: string,
    input: UpdateFiveSIndicatorRequest,
  ): Promise<FiveSIndicator>;
  setSeguimiento5sIndicatorActive(id: string, active: boolean): Promise<void>;
  listSeguimiento5sParticipants(): Promise<FiveSParticipant[]>;
  setSeguimiento5sParticipantRole(userId: string, roleKey: FiveSRoleKey): Promise<void>;
  getSeguimiento5sDailyEntries(entryDate: string): Promise<FiveSDailyEntries>;
  saveSeguimiento5sDailyEntries(input: SaveFiveSDailyEntriesRequest): Promise<FiveSDailyEntries>;
  getSeguimiento5sDashboardSummary(from: string, to: string): Promise<FiveSDashboardSummary>;
}

export class ApplicationsApiUnavailableError extends Error {
  readonly code = 'APPLICATIONS_API_UNAVAILABLE';

  constructor(
    readonly operation: keyof ApplicationsApi,
    options: ErrorOptions,
  ) {
    super('No fue posible comunicarse con la API de aplicaciones.', options);
    this.name = 'ApplicationsApiUnavailableError';
  }
}

export function createApplicationsApi(
  baseUrl: string,
  fetchImplementation: typeof fetch = fetch,
): ApplicationsApi {
  const client = createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: fetchImplementation,
  });

  return {
    async listAuthorizedApplications(): Promise<AuthorizedApplication[]> {
      const { data, response } = await client.GET('/api/applications').catch((error: unknown) => {
        throw new ApplicationsApiUnavailableError('listAuthorizedApplications', {
          cause: error,
        });
      });

      if (!response.ok) {
        throw createApiHttpError(response);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin la lista esperada de aplicaciones autorizadas.');
      }

      return data;
    },
    async requestHelloWorldJoke(input: HelloWorldJokeRequest): Promise<HelloWorldJoke> {
      const { data, response } = await client
        .POST('/api/applications/hello-world/joke', {
          body: input,
          headers: { 'x-timbo-csrf': '1' },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('requestHelloWorldJoke', { cause: error });
        });

      if (!response.ok) {
        throw createApiHttpError(response);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin el chiste traducido esperado.');
      }

      return data;
    },
    async listListaPreciosVehicles(): Promise<VehicleResponse[]> {
      const { data, response } = await client
        .GET('/api/applications/lista-precios/vehicles')
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('listListaPreciosVehicles', { cause: error });
        });

      if (!response.ok) {
        throw createApiHttpError(response);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin el catálogo de vehículos esperado.');
      }

      return data;
    },
    async recordListaPreciosUsageEvent(input: ListaPreciosUsageEventRequest): Promise<void> {
      const { response } = await client
        .POST('/api/applications/lista-precios/usage-events', {
          body: input,
          headers: { 'x-timbo-csrf': '1' },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('recordListaPreciosUsageEvent', {
            cause: error,
          });
        });

      if (!response.ok) {
        throw createApiHttpError(response);
      }
    },
    async listMetaCompanyGoals(period, empresaId) {
      const { data, response } = await client.GET('/api/applications/meta-company/goals', {
        params: { query: { period, ...(empresaId === undefined ? {} : { empresaId: String(empresaId) }) } },
      });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin las metas esperadas.');
      return data;
    },
    async listMetaCompanyCatalogs() {
      const { data, response } = await client.GET('/api/applications/meta-company/catalogs');
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin los catálogos esperados.');
      return data;
    },
    async listAllMetaCompanyCatalogs() {
      const { data, response } = await client.GET('/api/applications/meta-company/catalogs/all');
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin los catálogos esperados.');
      return data;
    },
    async getMetaCompanyCapabilities() {
      const { data, response } = await client.GET('/api/applications/meta-company/capabilities');
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin las capacidades esperadas.');
      return data;
    },
    async createMetaCompanyBrandGoal(input) {
      const { data, response } = await client.POST('/api/applications/meta-company/brand-goals', {
        body: input,
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin la meta creada.');
      return data;
    },
    async createMetaCompanyAdvisorGoal(input) {
      const { data, response } = await client.POST('/api/applications/meta-company/advisor-goals', {
        body: input,
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin la meta creada.');
      return data;
    },
    async updateMetaCompanyBrandGoal(id, value) {
      const { data, response } = await client.PATCH(
        '/api/applications/meta-company/brand-goals/{id}',
        {
          params: { path: { id: String(id) } },
          body: { value },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin la meta actualizada.');
      return data;
    },
    async updateMetaCompanyAdvisorGoal(id, value, workingDays) {
      const { data, response } = await client.PATCH(
        '/api/applications/meta-company/advisor-goals/{id}',
        {
          params: { path: { id: String(id) } },
          body: { value, ...(workingDays === undefined ? {} : { workingDays }) },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin la meta actualizada.');
      return data;
    },
    async createMetaCompanyBrand(input) {
      const { data, response } = await client.POST('/api/applications/meta-company/brands', {
        body: input,
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin la marca creada.');
      return data;
    },
    async createMetaCompanyBusiness(input) {
      const { data, response } = await client.POST('/api/applications/meta-company/businesses', {
        body: input,
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el negocio creado.');
      return data;
    },
    async createMetaCompanyAdvisor(input) {
      const { data, response } = await client.POST('/api/applications/meta-company/advisors', {
        body: input,
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el asesor creado.');
      return data;
    },
    async updateMetaCompanyAdvisor(id, input) {
      const { data, response } = await client.PATCH('/api/applications/meta-company/advisors/{id}', {
        params: { path: { id: String(id) } },
        body: input,
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el asesor actualizado.');
      return data;
    },
    async setMetaCompanyAdvisorActive(id, active) {
      const { data, response } = await client.PATCH(
        '/api/applications/meta-company/advisors/{id}/active',
        {
          params: { path: { id: String(id) } },
          body: { active },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el asesor actualizado.');
      return data;
    },
    async getSeguimiento5sCapabilities(): Promise<FiveSCapabilities> {
      const { data, response } = await client
        .GET('/api/applications/seguimiento-5s/capabilities')
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('getSeguimiento5sCapabilities', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin las capacidades esperadas.');
      return data;
    },
    async listSeguimiento5sIndicators(includeInactive: boolean): Promise<FiveSIndicator[]> {
      const { data, response } = await client
        .GET('/api/applications/seguimiento-5s/indicators', {
          params: { query: { includeInactive: String(includeInactive) } },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('listSeguimiento5sIndicators', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin los indicadores esperados.');
      return data;
    },
    async createSeguimiento5sIndicator(
      input: CreateFiveSIndicatorRequest,
    ): Promise<FiveSIndicator> {
      const { data, response } = await client
        .POST('/api/applications/seguimiento-5s/indicators', {
          body: input,
          headers: { 'x-timbo-csrf': '1' },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('createSeguimiento5sIndicator', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el indicador creado.');
      return data;
    },
    async updateSeguimiento5sIndicator(
      id: string,
      input: UpdateFiveSIndicatorRequest,
    ): Promise<FiveSIndicator> {
      const { data, response } = await client
        .PATCH('/api/applications/seguimiento-5s/indicators/{id}', {
          params: { path: { id } },
          body: input,
          headers: { 'x-timbo-csrf': '1' },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('updateSeguimiento5sIndicator', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el indicador editado.');
      return data;
    },
    async setSeguimiento5sIndicatorActive(id: string, active: boolean): Promise<void> {
      const path = active
        ? '/api/applications/seguimiento-5s/indicators/{id}/reactivate'
        : '/api/applications/seguimiento-5s/indicators/{id}/deactivate';
      const { response } = await client
        .POST(path, {
          params: { path: { id } },
          headers: { 'x-timbo-csrf': '1' },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('setSeguimiento5sIndicatorActive', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
    },
    async listSeguimiento5sParticipants(): Promise<FiveSParticipant[]> {
      const { data, response } = await client
        .GET('/api/applications/seguimiento-5s/participants')
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('listSeguimiento5sParticipants', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin los participantes esperados.');
      return data;
    },
    async setSeguimiento5sParticipantRole(userId: string, roleKey: FiveSRoleKey): Promise<void> {
      const { response } = await client
        .POST('/api/applications/seguimiento-5s/participants/{userId}/role', {
          params: { path: { userId } },
          body: { roleKey },
          headers: { 'x-timbo-csrf': '1' },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('setSeguimiento5sParticipantRole', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
    },
    async getSeguimiento5sDailyEntries(entryDate: string): Promise<FiveSDailyEntries> {
      const { data, response } = await client
        .GET('/api/applications/seguimiento-5s/entries', {
          params: { query: { date: entryDate } },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('getSeguimiento5sDailyEntries', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el checklist diario esperado.');
      return data;
    },
    async saveSeguimiento5sDailyEntries(
      input: SaveFiveSDailyEntriesRequest,
    ): Promise<FiveSDailyEntries> {
      const { data, response } = await client
        .PUT('/api/applications/seguimiento-5s/entries', {
          body: input,
          headers: { 'x-timbo-csrf': '1' },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('saveSeguimiento5sDailyEntries', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) throw new Error('La API respondió sin el checklist diario guardado.');
      return data;
    },
    async getSeguimiento5sDashboardSummary(
      from: string,
      to: string,
    ): Promise<FiveSDashboardSummary> {
      const { data, response } = await client
        .GET('/api/applications/seguimiento-5s/dashboard/summary', {
          params: { query: { from, to } },
        })
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('getSeguimiento5sDashboardSummary', {
            cause: error,
          });
        });
      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined)
        throw new Error('La API respondió sin el resumen de dashboard esperado.');
      return data;
    },
  };
}
