import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { isValidIncomingRequestId } from '@timbo/observability';

export type HealthResponse = NonNullable<
  paths['/api/health']['get']['responses'][200]['content']['application/json']
>;

export interface SystemApi {
  getHealth(): Promise<HealthResponse>;
}

export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(`La API respondió con el estado HTTP ${String(status)}.`);
    this.name = 'ApiHttpError';
  }
}

export function createApiHttpError(response: Response): ApiHttpError {
  const responseRequestId = response.headers.get('x-request-id');
  const requestId =
    responseRequestId !== null && isValidIncomingRequestId(responseRequestId)
      ? responseRequestId
      : undefined;

  return new ApiHttpError(response.status, requestId);
}

export function createSystemApi(
  baseUrl: string,
  fetchImplementation: typeof fetch = fetch,
): SystemApi {
  const client = createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: fetchImplementation,
  });

  return {
    async getHealth(): Promise<HealthResponse> {
      const { data, response } = await client.GET('/api/health');

      if (!response.ok) {
        throw createApiHttpError(response);
      }

      if (data === undefined) {
        throw new Error('La API respondió sin el cuerpo esperado para su estado de salud.');
      }

      return data;
    },
  };
}
