import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';

export type HealthResponse = NonNullable<
  paths['/api/health']['get']['responses'][200]['content']['application/json']
>;

export interface SystemApi {
  getHealth(): Promise<HealthResponse>;
}

export class ApiHttpError extends Error {
  constructor(readonly status: number) {
    super(`La API respondió con el estado HTTP ${String(status)}.`);
    this.name = 'ApiHttpError';
  }
}

export function createSystemApi(
  baseUrl: string,
  fetchImplementation: typeof fetch = fetch,
): SystemApi {
  const client = createClient<paths>({ baseUrl, fetch: fetchImplementation });

  return {
    async getHealth(): Promise<HealthResponse> {
      const { data, response } = await client.GET('/api/health');

      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }

      if (data === undefined) {
        throw new Error('La API respondió sin el cuerpo esperado para su estado de salud.');
      }

      return data;
    },
  };
}
