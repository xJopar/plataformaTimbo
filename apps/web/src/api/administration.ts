import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { ApiHttpError } from './system';

export type AdministrativeUser = NonNullable<
  paths['/api/admin/users']['get']['responses'][200]['content']['application/json']
>[number];

export type AdministrativeApplication = NonNullable<
  paths['/api/admin/applications']['get']['responses'][200]['content']['application/json']
>[number];

export type AdministrativeUserApplicationAccess = NonNullable<
  paths['/api/admin/users/{userId}/applications']['get']['responses'][200]['content']['application/json']
>[number];

export type AdministrativeApplicationPermission = NonNullable<
  paths['/api/admin/applications/{applicationId}/permissions']['get']['responses'][200]['content']['application/json']
>[number];

export type AdministrativeApplicationProfile = NonNullable<
  paths['/api/admin/applications/{applicationId}/profiles']['get']['responses'][200]['content']['application/json']
>[number];

export type PreauthorizeAdministrativeUserBulkResult = NonNullable<
  paths['/api/admin/users/bulk']['post']['responses'][201]['content']['application/json']
>[number];

export type BulkApplicationAccessResult = NonNullable<
  paths['/api/admin/applications/{applicationId}/users/bulk-assign']['post']['responses'][200]['content']['application/json']
>[number];

export type BulkAdministrativeUserStatusResult = NonNullable<
  paths['/api/admin/users/bulk-activate']['post']['responses'][200]['content']['application/json']
>[number];

export interface ActivityFilters {
  datePreset?: 'today' | 'week' | 'month';
  dateFrom?: string;
  dateTo?: string;
  asOf?: string;
  actor?: string;
  source?: 'AUDIT' | 'USAGE';
  appKey?: string;
  eventName?: string;
  target?: string;
  limit?: number;
  offset?: number;
}

export type AdministrativeActivity = NonNullable<
  paths['/api/admin/activity']['get']['responses'][200]['content']['application/json']
>;
export type AdministrativeActivityItem = AdministrativeActivity['items'][number];
export type AdministrativeActivityStatistics = NonNullable<
  paths['/api/admin/activity/stats']['get']['responses'][200]['content']['application/json']
>;
export type AdministrativeActivityFilterOptions = NonNullable<
  paths['/api/admin/activity/options']['get']['responses'][200]['content']['application/json']
>;

export interface AdministrationApi {
  listApplications(): Promise<AdministrativeApplication[]>;
  createApplication(input: {
    key: string;
    name: string;
    description?: string | null;
    launchPath: string;
    displayOrder: number;
  }): Promise<AdministrativeApplication>;
  updateApplication(
    applicationId: string,
    input: {
      name?: string;
      description?: string | null;
      launchPath?: string;
      displayOrder?: number;
    },
  ): Promise<AdministrativeApplication>;
  deactivateApplication(applicationId: string): Promise<void>;
  reactivateApplication(applicationId: string): Promise<void>;
  listUserApplicationAccesses(userId: string): Promise<AdministrativeUserApplicationAccess[]>;
  assignApplicationToUser(userId: string, applicationId: string): Promise<void>;
  unassignApplicationFromUser(userId: string, applicationId: string): Promise<void>;
  listApplicationPermissions(applicationId: string): Promise<AdministrativeApplicationPermission[]>;
  listApplicationProfiles(applicationId: string): Promise<AdministrativeApplicationProfile[]>;
  createApplicationProfile(
    applicationId: string,
    input: { key: string; name: string; description?: string | null },
  ): Promise<AdministrativeApplicationProfile>;
  updateApplicationProfile(
    profileId: string,
    input: { name?: string; description?: string | null },
  ): Promise<AdministrativeApplicationProfile>;
  deactivateApplicationProfile(profileId: string): Promise<void>;
  reactivateApplicationProfile(profileId: string): Promise<void>;
  addPermissionToApplicationProfile(profileId: string, permissionId: string): Promise<void>;
  removePermissionFromApplicationProfile(profileId: string, permissionId: string): Promise<void>;
  assignApplicationProfileToUser(userId: string, profileId: string): Promise<void>;
  unassignApplicationProfileFromUser(userId: string, profileId: string): Promise<void>;
  listUsers(search?: string): Promise<AdministrativeUser[]>;
  preauthorizeUser(input: { corporateEmail: string }): Promise<AdministrativeUser>;
  preauthorizeUsersBulk(
    entries: { corporateEmail: string }[],
  ): Promise<PreauthorizeAdministrativeUserBulkResult[]>;
  assignApplicationToUsers(
    applicationId: string,
    userIds: string[],
  ): Promise<BulkApplicationAccessResult[]>;
  unassignApplicationFromUsers(
    applicationId: string,
    userIds: string[],
  ): Promise<BulkApplicationAccessResult[]>;
  updateUser(userId: string, input: { displayName: string | null }): Promise<AdministrativeUser>;
  deactivateUser(userId: string): Promise<void>;
  reactivateUser(userId: string): Promise<void>;
  activateUsers(userIds: string[]): Promise<BulkAdministrativeUserStatusResult[]>;
  deactivateUsers(userIds: string[]): Promise<BulkAdministrativeUserStatusResult[]>;
  grantPlatformAdministrator(userId: string): Promise<void>;
  revokePlatformAdministrator(userId: string): Promise<void>;
  listActivity(filters?: ActivityFilters): Promise<AdministrativeActivity>;
  getActivityStatistics(filters?: ActivityFilters): Promise<AdministrativeActivityStatistics>;
  getActivityFilterOptions(filters?: ActivityFilters): Promise<AdministrativeActivityFilterOptions>;
  downloadActivityCsv(filters?: ActivityFilters): Promise<Blob>;
}

export function createAdministrationApi(
  baseUrl: string,
  fetchImplementation: typeof fetch = fetch,
): AdministrationApi {
  const client = createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: fetchImplementation,
  });

  return {
    async listApplications(): Promise<AdministrativeApplication[]> {
      const { data, response } = await client.GET('/api/admin/applications');
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) {
        throw new Error('La API respondió sin la lista esperada de aplicaciones.');
      }
      return data;
    },

    async createApplication(input): Promise<AdministrativeApplication> {
      const { data, response } = await client.POST('/api/admin/applications', {
        headers: { 'x-timbo-csrf': '1' },
        body: input,
      });
      return requireAdministrativeApplicationResponse(data, response.status, response.ok);
    },

    async updateApplication(applicationId, input): Promise<AdministrativeApplication> {
      const { data, response } = await client.PATCH('/api/admin/applications/{applicationId}', {
        params: { path: { applicationId } },
        headers: { 'x-timbo-csrf': '1' },
        body: input,
      });
      return requireAdministrativeApplicationResponse(data, response.status, response.ok);
    },

    async deactivateApplication(applicationId): Promise<void> {
      const { response } = await client.POST('/api/admin/applications/{applicationId}/deactivate', {
        params: { path: { applicationId } },
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async reactivateApplication(applicationId): Promise<void> {
      const { response } = await client.POST('/api/admin/applications/{applicationId}/reactivate', {
        params: { path: { applicationId } },
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async listUserApplicationAccesses(userId): Promise<AdministrativeUserApplicationAccess[]> {
      const { data, response } = await client.GET('/api/admin/users/{userId}/applications', {
        params: { path: { userId } },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) {
        throw new Error('La API respondió sin las asignaciones esperadas.');
      }
      return data;
    },

    async assignApplicationToUser(userId, applicationId): Promise<void> {
      const { response } = await client.POST(
        '/api/admin/users/{userId}/applications/{applicationId}',
        {
          params: { path: { userId, applicationId } },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async unassignApplicationFromUser(userId, applicationId): Promise<void> {
      const { response } = await client.DELETE(
        '/api/admin/users/{userId}/applications/{applicationId}',
        {
          params: { path: { userId, applicationId } },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async listApplicationPermissions(
      applicationId,
    ): Promise<AdministrativeApplicationPermission[]> {
      const { data, response } = await client.GET(
        '/api/admin/applications/{applicationId}/permissions',
        {
          params: { path: { applicationId } },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin los permisos esperados.');
      return data;
    },

    async listApplicationProfiles(applicationId): Promise<AdministrativeApplicationProfile[]> {
      const { data, response } = await client.GET(
        '/api/admin/applications/{applicationId}/profiles',
        {
          params: { path: { applicationId } },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin los perfiles esperados.');
      return data;
    },

    async createApplicationProfile(
      applicationId,
      input,
    ): Promise<AdministrativeApplicationProfile> {
      const { data, response } = await client.POST(
        '/api/admin/applications/{applicationId}/profiles',
        {
          params: { path: { applicationId } },
          headers: { 'x-timbo-csrf': '1' },
          body: input,
        },
      );
      return requireAdministrativeApplicationProfileResponse(data, response.status, response.ok);
    },

    async updateApplicationProfile(profileId, input): Promise<AdministrativeApplicationProfile> {
      const { data, response } = await client.PATCH('/api/admin/application-profiles/{profileId}', {
        params: { path: { profileId } },
        headers: { 'x-timbo-csrf': '1' },
        body: input,
      });
      return requireAdministrativeApplicationProfileResponse(data, response.status, response.ok);
    },

    async deactivateApplicationProfile(profileId): Promise<void> {
      const { response } = await client.POST(
        '/api/admin/application-profiles/{profileId}/deactivate',
        {
          params: { path: { profileId } },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async reactivateApplicationProfile(profileId): Promise<void> {
      const { response } = await client.POST(
        '/api/admin/application-profiles/{profileId}/reactivate',
        {
          params: { path: { profileId } },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async addPermissionToApplicationProfile(profileId, permissionId): Promise<void> {
      const { response } = await client.POST(
        '/api/admin/application-profiles/{profileId}/permissions/{permissionId}',
        { params: { path: { profileId, permissionId } }, headers: { 'x-timbo-csrf': '1' } },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async removePermissionFromApplicationProfile(profileId, permissionId): Promise<void> {
      const { response } = await client.DELETE(
        '/api/admin/application-profiles/{profileId}/permissions/{permissionId}',
        { params: { path: { profileId, permissionId } }, headers: { 'x-timbo-csrf': '1' } },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async assignApplicationProfileToUser(userId, profileId): Promise<void> {
      const { response } = await client.POST(
        '/api/admin/users/{userId}/application-profiles/{profileId}',
        {
          params: { path: { userId, profileId } },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async unassignApplicationProfileFromUser(userId, profileId): Promise<void> {
      const { response } = await client.DELETE(
        '/api/admin/users/{userId}/application-profiles/{profileId}',
        {
          params: { path: { userId, profileId } },
          headers: { 'x-timbo-csrf': '1' },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async listUsers(search?: string): Promise<AdministrativeUser[]> {
      const { data, response } = await client.GET('/api/admin/users', {
        params: { query: search === undefined ? undefined : { search } },
      });
      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin la lista esperada de usuarios.');
      }
      return data;
    },

    async preauthorizeUser(input): Promise<AdministrativeUser> {
      const { data, response } = await client.POST('/api/admin/users', {
        headers: { 'x-timbo-csrf': '1' },
        body: input,
      });
      return requireAdministrativeUserResponse(data, response.status, response.ok);
    },

    async preauthorizeUsersBulk(entries): Promise<PreauthorizeAdministrativeUserBulkResult[]> {
      const { data, response } = await client.POST('/api/admin/users/bulk', {
        headers: { 'x-timbo-csrf': '1' },
        body: { entries },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin el resultado esperado.');
      return data;
    },

    async assignApplicationToUsers(applicationId, userIds): Promise<BulkApplicationAccessResult[]> {
      const { data, response } = await client.POST(
        '/api/admin/applications/{applicationId}/users/bulk-assign',
        {
          params: { path: { applicationId } },
          headers: { 'x-timbo-csrf': '1' },
          body: { userIds },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin el resultado esperado.');
      return data;
    },

    async unassignApplicationFromUsers(
      applicationId,
      userIds,
    ): Promise<BulkApplicationAccessResult[]> {
      const { data, response } = await client.POST(
        '/api/admin/applications/{applicationId}/users/bulk-unassign',
        {
          params: { path: { applicationId } },
          headers: { 'x-timbo-csrf': '1' },
          body: { userIds },
        },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin el resultado esperado.');
      return data;
    },

    async updateUser(userId, input): Promise<AdministrativeUser> {
      const { data, response } = await client.PATCH('/api/admin/users/{userId}', {
        params: { path: { userId } },
        headers: { 'x-timbo-csrf': '1' },
        body: input,
      });
      return requireAdministrativeUserResponse(data, response.status, response.ok);
    },

    async deactivateUser(userId): Promise<void> {
      const { response } = await client.POST('/api/admin/users/{userId}/deactivate', {
        params: { path: { userId } },
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }
    },

    async reactivateUser(userId): Promise<void> {
      const { response } = await client.POST('/api/admin/users/{userId}/reactivate', {
        params: { path: { userId } },
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }
    },

    async activateUsers(userIds): Promise<BulkAdministrativeUserStatusResult[]> {
      const { data, response } = await client.POST('/api/admin/users/bulk-activate', {
        headers: { 'x-timbo-csrf': '1' },
        body: { userIds },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin el resultado esperado.');
      return data;
    },

    async deactivateUsers(userIds): Promise<BulkAdministrativeUserStatusResult[]> {
      const { data, response } = await client.POST('/api/admin/users/bulk-deactivate', {
        headers: { 'x-timbo-csrf': '1' },
        body: { userIds },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin el resultado esperado.');
      return data;
    },

    async grantPlatformAdministrator(userId): Promise<void> {
      const { response } = await client.POST('/api/admin/users/{userId}/platform-administrator', {
        params: { path: { userId } },
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async revokePlatformAdministrator(userId): Promise<void> {
      const { response } = await client.POST(
        '/api/admin/users/{userId}/platform-administrator/revoke',
        { params: { path: { userId } }, headers: { 'x-timbo-csrf': '1' } },
      );
      if (!response.ok) throw new ApiHttpError(response.status);
    },

    async listActivity(filters = {}): Promise<AdministrativeActivity> {
      const { data, response } = await client.GET('/api/admin/activity', {
        params: { query: serializeActivityFilters(filters) },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin la actividad esperada.');
      return data;
    },

    async getActivityStatistics(filters = {}): Promise<AdministrativeActivityStatistics> {
      const { data, response } = await client.GET('/api/admin/activity/stats', {
        params: { query: serializeActivityFilters(filters) },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined) throw new Error('La API respondió sin las estadísticas esperadas.');
      return data;
    },

    async getActivityFilterOptions(filters = {}): Promise<AdministrativeActivityFilterOptions> {
      const { data, response } = await client.GET('/api/admin/activity/options', {
        params: { query: serializeActivityFilters(filters) },
      });
      if (!response.ok) throw new ApiHttpError(response.status);
      if (data === undefined)
        throw new Error('La API respondió sin las opciones de actividad esperadas.');
      return data;
    },

    async downloadActivityCsv(filters = {}): Promise<Blob> {
      const url = new URL('/api/admin/activity/export', baseUrl);
      for (const [key, value] of Object.entries(serializeActivityFilters(filters))) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
      const response = await fetchImplementation(url, { credentials: 'include' });
      if (!response.ok) throw new ApiHttpError(response.status);
      return response.blob();
    },
  };
}

function requireAdministrativeApplicationResponse(
  data: AdministrativeApplication | undefined,
  status: number,
  isSuccessful: boolean,
): AdministrativeApplication {
  if (!isSuccessful) throw new ApiHttpError(status);
  if (data === undefined) throw new Error('La API respondió sin la aplicación esperada.');
  return data;
}

function requireAdministrativeApplicationProfileResponse(
  data: AdministrativeApplicationProfile | undefined,
  status: number,
  isSuccessful: boolean,
): AdministrativeApplicationProfile {
  if (!isSuccessful) throw new ApiHttpError(status);
  if (data === undefined) throw new Error('La API respondió sin el perfil funcional esperado.');
  return data;
}

function serializeActivityFilters(filters: ActivityFilters): Record<string, string | undefined> {
  const serialized: Record<string, string | undefined> = {};
  const entries: readonly (readonly [string, string | number | undefined])[] = [
    ['datePreset', filters.datePreset],
    ['dateFrom', filters.dateFrom],
    ['dateTo', filters.dateTo],
    ['asOf', filters.asOf],
    ['actor', filters.actor],
    ['source', filters.source],
    ['appKey', filters.appKey],
    ['eventName', filters.eventName],
    ['target', filters.target],
    ['limit', filters.limit],
    ['offset', filters.offset],
  ];
  for (const [key, value] of entries) {
    if (value === undefined || value === '') continue;
    serialized[key] = typeof value === 'number' ? value.toString() : value;
  }
  return serialized;
}

function requireAdministrativeUserResponse(
  data: AdministrativeUser | undefined,
  status: number,
  isSuccessful: boolean,
): AdministrativeUser {
  if (!isSuccessful) {
    throw new ApiHttpError(status);
  }
  if (data === undefined) {
    throw new Error('La API respondió sin el usuario esperado.');
  }
  return data;
}
