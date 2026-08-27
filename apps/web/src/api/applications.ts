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

export interface ApplicationsApi {
  listAuthorizedApplications(): Promise<AuthorizedApplication[]>;
  requestHelloWorldJoke(input: HelloWorldJokeRequest): Promise<HelloWorldJoke>;
  listListaPreciosVehicles(): Promise<VehicleResponse[]>;
  recordListaPreciosUsageEvent(input: ListaPreciosUsageEventRequest): Promise<void>;
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
  };
}
