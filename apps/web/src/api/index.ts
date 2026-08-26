import { createAuthApi } from './auth';
import { createAdministrationApi } from './administration';
import { createApplicationsApi } from './applications';
import { createSystemApi } from './system';

export interface Api {
  auth: ReturnType<typeof createAuthApi>;
  administration: ReturnType<typeof createAdministrationApi>;
  applications: ReturnType<typeof createApplicationsApi>;
  system: ReturnType<typeof createSystemApi>;
}

export function createApi(baseUrl: string): Api {
  return {
    auth: createAuthApi(baseUrl),
    administration: createAdministrationApi(baseUrl),
    applications: createApplicationsApi(baseUrl),
    system: createSystemApi(baseUrl),
  };
}

export { type AuthApi, type AuthSession } from './auth';
export {
  type ActivityFilters,
  type AdministrativeApplication,
  type AdministrativeApplicationPermission,
  type AdministrativeApplicationProfile,
  type AdministrativeActivity,
  type AdministrativeActivityFilterOptions,
  type AdministrativeActivityItem,
  type AdministrativeActivityStatistics,
  type AdministrationApi,
  type AdministrativeUser,
  type AdministrativeUserApplicationAccess,
  type BulkApplicationAccessResult,
  type PreauthorizeAdministrativeUserBulkResult,
} from './administration';
export { ApiHttpError, createApiHttpError, type HealthResponse, type SystemApi } from './system';
export { ApplicationsApiUnavailableError } from './applications';
export {
  type ApplicationsApi,
  type AuthorizedApplication,
  type HelloWorldJoke,
  createApplicationsApi,
} from './applications';
