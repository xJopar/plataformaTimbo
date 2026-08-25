import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { createApiHttpError } from './system';

export type AuthorizedApplication = NonNullable<
  paths['/api/applications']['get']['responses'][200]['content']['application/json']
>[number];

export type HelloWorldJoke = NonNullable<
  paths['/api/applications/hello-world/joke']['get']['responses'][200]['content']['application/json']
>;

export interface ApplicationsApi {
  listAuthorizedApplications(): Promise<AuthorizedApplication[]>;
  getHelloWorldJoke(): Promise<HelloWorldJoke>;
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
    async getHelloWorldJoke(): Promise<HelloWorldJoke> {
      const { data, response } = await client
        .GET('/api/applications/hello-world/joke')
        .catch((error: unknown) => {
          throw new ApplicationsApiUnavailableError('getHelloWorldJoke', { cause: error });
        });

      if (!response.ok) {
        throw createApiHttpError(response);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin el chiste traducido esperado.');
      }

      return data;
    },
  };
}
