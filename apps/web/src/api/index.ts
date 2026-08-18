import { createSystemApi } from './system';

export interface Api {
  system: ReturnType<typeof createSystemApi>;
}

export function createApi(baseUrl: string): Api {
  return {
    system: createSystemApi(baseUrl),
  };
}

export { ApiHttpError, type HealthResponse, type SystemApi } from './system';
