import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { ApiHttpError } from './system';

export type AuthorizedApplication = NonNullable<
  paths['/api/applications']['get']['responses'][200]['content']['application/json']
>[number];

export interface ApplicationsApi {
  listAuthorizedApplications(): Promise<AuthorizedApplication[]>;
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
  };
}
