import { createAuthApi } from './auth';
import { createSystemApi } from './system';

export interface Api {
  auth: ReturnType<typeof createAuthApi>;
  system: ReturnType<typeof createSystemApi>;
}

export function createApi(baseUrl: string): Api {
  return {
    auth: createAuthApi(baseUrl),
    system: createSystemApi(baseUrl),
  };
}

export { type AuthApi, type AuthSession } from './auth';
export { ApiHttpError, type HealthResponse, type SystemApi } from './system';
