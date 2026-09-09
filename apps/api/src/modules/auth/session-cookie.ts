import type { SessionCookieConfig } from '../../runtime-config';

export const SESSION_COOKIE_NAME = 'timbo_session';

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }

  for (const cookiePart of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split('=');
    if (rawName === SESSION_COOKIE_NAME && rawValueParts.length === 1) {
      const rawValue = rawValueParts[0];
      return rawValue === undefined || rawValue === '' ? undefined : rawValue;
    }
  }

  return undefined;
}

export function toSessionCookieOptions(config: SessionCookieConfig): SessionCookieConfig {
  return config;
}
