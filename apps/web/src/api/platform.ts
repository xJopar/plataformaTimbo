import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { createApiHttpError } from './system';

export type PlatformBootstrap = NonNullable<
  paths['/api/platform/bootstrap']['get']['responses'][200]['content']['application/json']
>;

export class PlatformApiUnavailableError extends Error {
  public constructor(
    readonly operation: 'getBootstrap',
    options: ErrorOptions,
  ) {
    super('No fue posible conectar con la API de Plataforma Timbo.', options);
    this.name = 'PlatformApiUnavailableError';
  }
}

export interface PlatformApi {
  getBootstrap(): Promise<PlatformBootstrap>;
}

export function createPlatformApi(
  baseUrl: string,
  fetchImplementation: typeof fetch = fetch,
): PlatformApi {
  const client = createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: fetchImplementation,
  });

  return {
    async getBootstrap(): Promise<PlatformBootstrap> {
      const { data, response } = await client
        .GET('/api/platform/bootstrap')
        .catch((error: unknown) => {
          throw new PlatformApiUnavailableError('getBootstrap', { cause: error });
        });

      if (!response.ok) throw createApiHttpError(response);
      if (data === undefined) {
        throw new Error('La API respondió sin los datos esperados para iniciar la plataforma.');
      }

      return data;
    },
  };
}
