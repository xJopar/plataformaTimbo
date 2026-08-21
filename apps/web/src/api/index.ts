import { createAuthApi } from './auth';
import { createAdministrationApi } from './administration';
import { createSystemApi } from './system';

export interface Api {
  auth: ReturnType<typeof createAuthApi>;
  administration: ReturnType<typeof createAdministrationApi>;
  system: ReturnType<typeof createSystemApi>;
}

export function createApi(baseUrl: string): Api {
  return {
    auth: createAuthApi(baseUrl),
    administration: createAdministrationApi(baseUrl),
    system: createSystemApi(baseUrl),
  };
}

export { type AuthApi, type AuthSession } from './auth';
export {
  type ActivityFilters,
  type AdministrativeActivity,
  type AdministrativeActivityFilterOptions,
  type AdministrativeActivityItem,
  type AdministrativeActivityStatistics,
  type AdministrationApi,
  type AdministrativeUser,
} from './administration';
export { ApiHttpError, type HealthResponse, type SystemApi } from './system';
