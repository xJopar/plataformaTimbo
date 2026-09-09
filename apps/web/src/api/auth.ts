import createClient from 'openapi-fetch';
import type { paths } from '@timbo/contracts/openapi';
import { ApiHttpError } from './system';

export type AuthSession = NonNullable<
  paths['/api/auth/session']['get']['responses'][200]['content']['application/json']
>;

export interface AuthApi {
  getSession(): Promise<AuthSession>;
  logout(): Promise<void>;
  getGoogleLoginUrl(): string;
}

export function createAuthApi(baseUrl: string, fetchImplementation: typeof fetch = fetch): AuthApi {
  const client = createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: fetchImplementation,
  });

  return {
    async getSession(): Promise<AuthSession> {
      const { data, response } = await client.GET('/api/auth/session');

      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }
      if (data === undefined) {
        throw new Error('La API respondió sin la identidad esperada para la sesión.');
      }

      return data;
    },

    async logout(): Promise<void> {
      const { response } = await client.POST('/api/auth/logout', {
        headers: { 'x-timbo-csrf': '1' },
      });
      if (!response.ok) {
        throw new ApiHttpError(response.status);
      }
    },

    getGoogleLoginUrl(): string {
      return new URL('/api/auth/google', baseUrl).toString();
    },
  };
}
