export interface RuntimeConfig {
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  googleOAuth: GoogleOAuthConfig;
  sessionCookie: SessionCookieConfig;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SessionCookieConfig {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'none';
  maxAgeMs: number;
  path: '/';
}

export const DEFAULT_PORT = 3000;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

const MIN_PORT = 1;
const MAX_PORT = 65535;
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const GOOGLE_OAUTH_CALLBACK_PATH = '/api/auth/google/callback';

function resolvePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const isPositiveInteger = /^\d+$/.test(rawPort);
  const parsedPort = Number(rawPort);

  if (!isPositiveInteger || parsedPort < MIN_PORT || parsedPort > MAX_PORT) {
    throw new Error(
      `La variable de entorno PORT debe ser un número entero entre ${String(MIN_PORT)} y ${String(MAX_PORT)} (valor recibido: "${rawPort}").`,
    );
  }

  return parsedPort;
}

function resolveCorsOrigin(rawCorsOrigin: string | undefined): string {
  if (rawCorsOrigin === undefined) {
    return DEFAULT_CORS_ORIGIN;
  }

  const invalidOriginMessage = `La variable de entorno CORS_ORIGIN debe ser un origen HTTP o HTTPS válido, sin ruta, parámetros ni fragmento (valor recibido: "${rawCorsOrigin}").`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawCorsOrigin);
  } catch {
    throw new Error(invalidOriginMessage);
  }

  const isHttpProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  const hasExtraSegments =
    parsedUrl.pathname !== '/' || parsedUrl.search !== '' || parsedUrl.hash !== '';

  if (!isHttpProtocol || hasExtraSegments) {
    throw new Error(invalidOriginMessage);
  }

  return parsedUrl.origin;
}

export function resolveDatabaseUrl(rawDatabaseUrl: string | undefined): string {
  const invalidDatabaseUrlMessage =
    'La variable de entorno DATABASE_URL es obligatoria y debe ser una URL PostgreSQL valida.';

  if (rawDatabaseUrl === undefined || rawDatabaseUrl.trim() === '') {
    throw new Error(invalidDatabaseUrlMessage);
  }

  try {
    const parsedUrl = new URL(rawDatabaseUrl);
    if (parsedUrl.protocol !== 'postgresql:' && parsedUrl.protocol !== 'postgres:') {
      throw new Error(invalidDatabaseUrlMessage);
    }
  } catch {
    throw new Error(invalidDatabaseUrlMessage);
  }

  return rawDatabaseUrl;
}

export function resolveDatabaseUrlFromEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  return resolveDatabaseUrl(env.DATABASE_URL);
}

function resolveRequiredGoogleValue(rawValue: string | undefined, variableName: string): string {
  if (rawValue === undefined || rawValue.trim() === '') {
    throw new Error(`La variable de entorno ${variableName} es obligatoria.`);
  }

  return rawValue;
}

function resolveGoogleOAuthRedirectUri(rawRedirectUri: string | undefined): URL {
  const invalidRedirectUriMessage =
    'La variable de entorno GOOGLE_OAUTH_REDIRECT_URI debe ser una URL HTTP o HTTPS valida del callback de Google, sin parametros ni fragmento.';
  const redirectUri = resolveRequiredGoogleValue(rawRedirectUri, 'GOOGLE_OAUTH_REDIRECT_URI');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redirectUri);
  } catch {
    throw new Error(invalidRedirectUriMessage);
  }

  const isHttpProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  const isExactCallbackPath = parsedUrl.pathname === GOOGLE_OAUTH_CALLBACK_PATH;
  const hasExtraSegments = parsedUrl.search !== '' || parsedUrl.hash !== '';

  if (!isHttpProtocol || !isExactCallbackPath || hasExtraSegments) {
    throw new Error(invalidRedirectUriMessage);
  }

  return parsedUrl;
}

function resolveSessionCookieConfig(redirectUri: URL): SessionCookieConfig {
  const isLocalhost =
    redirectUri.hostname === 'localhost' ||
    redirectUri.hostname === '127.0.0.1' ||
    redirectUri.hostname === '[::1]';

  if (redirectUri.protocol === 'http:' && !isLocalhost) {
    throw new Error(
      'La variable de entorno GOOGLE_OAUTH_REDIRECT_URI debe usar HTTPS fuera de localhost.',
    );
  }

  return {
    httpOnly: true,
    secure: !isLocalhost,
    sameSite: isLocalhost ? 'lax' : 'none',
    maxAgeMs: SESSION_DURATION_MS,
    path: '/',
  };
}

export function resolveGoogleOAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleOAuthConfig & { sessionCookie: SessionCookieConfig } {
  const redirectUri = resolveGoogleOAuthRedirectUri(env.GOOGLE_OAUTH_REDIRECT_URI);

  return {
    clientId: resolveRequiredGoogleValue(env.GOOGLE_OAUTH_CLIENT_ID, 'GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: resolveRequiredGoogleValue(
      env.GOOGLE_OAUTH_CLIENT_SECRET,
      'GOOGLE_OAUTH_CLIENT_SECRET',
    ),
    redirectUri: redirectUri.toString(),
    sessionCookie: resolveSessionCookieConfig(redirectUri),
  };
}

/**
 * Resuelve y valida la configuración de runtime a partir de variables de entorno.
 * Se ejecuta antes de `NestFactory.create` para que una configuración inválida
 * aborte el arranque con un mensaje claro, en vez de dejar la API arriba con
 * valores incorrectos o fallar más tarde con un error genérico.
 */
export function resolveRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const googleOAuthConfig = resolveGoogleOAuthConfig(env);

  return {
    port: resolvePort(env.PORT),
    corsOrigin: resolveCorsOrigin(env.CORS_ORIGIN),
    databaseUrl: resolveDatabaseUrl(env.DATABASE_URL),
    googleOAuth: {
      clientId: googleOAuthConfig.clientId,
      clientSecret: googleOAuthConfig.clientSecret,
      redirectUri: googleOAuthConfig.redirectUri,
    },
    sessionCookie: googleOAuthConfig.sessionCookie,
  };
}
