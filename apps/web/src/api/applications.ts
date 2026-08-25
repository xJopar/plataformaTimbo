import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { ApiHttpError } from './system';

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
      const { data, response } = await client.GET('/api/applications');

      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin la lista esperada de aplicaciones autorizadas.');
      }

      return data;
    },
    async getHelloWorldJoke(): Promise<HelloWorldJoke> {
      const { data, response } = await client.GET('/api/applications/hello-world/joke');

      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin el chiste traducido esperado.');
      }

      return data;
    },
  };
}
