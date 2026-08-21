import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { ApiHttpError } from './system';

export type AdministrativeUser = NonNullable<
  paths['/api/admin/users']['get']['responses'][200]['content']['application/json']
>[number];

export interface AdministrationApi {
  listUsers(search?: string): Promise<AdministrativeUser[]>;
  preauthorizeUser(input: {
    corporateEmail: string;
    displayName?: string;
  }): Promise<AdministrativeUser>;
  updateUser(userId: string, input: { displayName: string | null }): Promise<AdministrativeUser>;
  deactivateUser(userId: string): Promise<void>;
  reactivateUser(userId: string): Promise<void>;
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
  };
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
