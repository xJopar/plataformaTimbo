import {
  DEFAULT_CORS_ORIGIN,
  DEFAULT_ENVIRONMENT,
  DEFAULT_PORT,
  SESSION_DURATION_MS,
  resolveDatabaseUrl,
  resolveEnvironment,
  resolveEnvironmentFromEnvironment,
  resolveGoogleOAuthConfig,
  resolveRuntimeConfig,
} from './runtime-config';

const TEST_DATABASE_URL = 'postgresql://user:password@localhost:5432/timbo';
const TEST_GOOGLE_OAUTH_ENVIRONMENT = {
  GOOGLE_OAUTH_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
};

describe('resolveRuntimeConfig', () => {
  it('usa los valores por defecto cuando PORT y CORS_ORIGIN estan ausentes', () => {
    const config = resolveRuntimeConfig({
      DATABASE_URL: TEST_DATABASE_URL,
      ...TEST_GOOGLE_OAUTH_ENVIRONMENT,
    });

    expect(config).toEqual({
      port: DEFAULT_PORT,
      corsOrigin: DEFAULT_CORS_ORIGIN,
      databaseUrl: TEST_DATABASE_URL,
      googleOAuth: {
        clientId: TEST_GOOGLE_OAUTH_ENVIRONMENT.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: TEST_GOOGLE_OAUTH_ENVIRONMENT.GOOGLE_OAUTH_CLIENT_SECRET,
        redirectUri: TEST_GOOGLE_OAUTH_ENVIRONMENT.GOOGLE_OAUTH_REDIRECT_URI,
      },
      sessionCookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: SESSION_DURATION_MS,
        path: '/',
      },
    });
  });

  it('acepta un PORT numerico valido dentro del rango permitido', () => {
    const config = resolveRuntimeConfig({
      PORT: '8080',
      DATABASE_URL: TEST_DATABASE_URL,
      ...TEST_GOOGLE_OAUTH_ENVIRONMENT,
    });

    expect(config.port).toBe(8080);
  });

  it.each(['abc', '3000.5', '0', '65536', '-1', ''])(
    'rechaza un PORT invalido: "%s"',
    (invalidPort) => {
      expect(() =>
        resolveRuntimeConfig({
          PORT: invalidPort,
          DATABASE_URL: TEST_DATABASE_URL,
          ...TEST_GOOGLE_OAUTH_ENVIRONMENT,
        }),
      ).toThrow(/La variable de entorno PORT debe ser un/);
    },
  );

  it('acepta un CORS_ORIGIN http(s) valido sin ruta, query ni fragmento', () => {
    const config = resolveRuntimeConfig({
      CORS_ORIGIN: 'https://timbo.example.com',
      DATABASE_URL: TEST_DATABASE_URL,
      ...TEST_GOOGLE_OAUTH_ENVIRONMENT,
    });

    expect(config.corsOrigin).toBe('https://timbo.example.com');
  });

  it.each([
    'not-a-url',
    'ftp://example.com',
    'http://localhost:5173/app',
    'http://localhost:5173?x=1',
    'http://localhost:5173#section',
  ])('rechaza un CORS_ORIGIN invalido: "%s"', (invalidOrigin) => {
    expect(() =>
      resolveRuntimeConfig({
        CORS_ORIGIN: invalidOrigin,
        DATABASE_URL: TEST_DATABASE_URL,
        ...TEST_GOOGLE_OAUTH_ENVIRONMENT,
      }),
    ).toThrow(/La variable de entorno CORS_ORIGIN debe ser un origen HTTP o HTTPS/);
  });

  it('rechaza la ausencia de DATABASE_URL sin incluir un valor sensible en el error', () => {
    expect(() => resolveDatabaseUrl(undefined)).toThrow(
      'La variable de entorno DATABASE_URL es obligatoria y debe ser una URL PostgreSQL valida.',
    );
  });

  it('rechaza undefined explícito aunque DATABASE_URL exista en el proceso', () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    try {
      expect(() => resolveDatabaseUrl(undefined)).toThrow(
        'La variable de entorno DATABASE_URL es obligatoria y debe ser una URL PostgreSQL valida.',
      );
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it.each(['not-a-url', 'https://database.example.com', 'mysql://database.example.com/timbo'])(
    'rechaza DATABASE_URL invalida',
    (invalidDatabaseUrl) => {
      expect(() => resolveDatabaseUrl(invalidDatabaseUrl)).toThrow(
        'La variable de entorno DATABASE_URL es obligatoria y debe ser una URL PostgreSQL valida.',
      );
    },
  );

  it.each([
    [
      'GOOGLE_OAUTH_CLIENT_ID',
      { ...TEST_GOOGLE_OAUTH_ENVIRONMENT, GOOGLE_OAUTH_CLIENT_ID: undefined },
    ],
    [
      'GOOGLE_OAUTH_CLIENT_SECRET',
      { ...TEST_GOOGLE_OAUTH_ENVIRONMENT, GOOGLE_OAUTH_CLIENT_SECRET: undefined },
    ],
    [
      'GOOGLE_OAUTH_REDIRECT_URI',
      { ...TEST_GOOGLE_OAUTH_ENVIRONMENT, GOOGLE_OAUTH_REDIRECT_URI: undefined },
    ],
  ] as const)('rechaza %s ausente sin incluir valores sensibles', (variableName, environment) => {
    expect(() => resolveGoogleOAuthConfig(environment)).toThrow(
      `La variable de entorno ${variableName} es obligatoria.`,
    );
  });

  it.each([
    'not-a-url',
    'ftp://localhost/api/auth/google/callback',
    'http://localhost:3000/otra-ruta',
    'http://localhost:3000/api/auth/google/callback?unexpected=true',
    'http://example.test/api/auth/google/callback',
  ])('rechaza un redirect URI invalido: %s', (redirectUri) => {
    expect(() =>
      resolveGoogleOAuthConfig({
        ...TEST_GOOGLE_OAUTH_ENVIRONMENT,
        GOOGLE_OAUTH_REDIRECT_URI: redirectUri,
      }),
    ).toThrow(/GOOGLE_OAUTH_REDIRECT_URI/);
  });

  it('usa cookie Secure y SameSite=None para un callback HTTPS de Railway', () => {
    const config = resolveGoogleOAuthConfig({
      ...TEST_GOOGLE_OAUTH_ENVIRONMENT,
      GOOGLE_OAUTH_REDIRECT_URI: 'https://api-development.example.test/api/auth/google/callback',
    });

    expect(config.sessionCookie).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    });
  });
});

describe('resolveEnvironment', () => {
  it('usa development por defecto cuando NODE_ENV está ausente o vacío', () => {
    expect(resolveEnvironment(undefined)).toBe(DEFAULT_ENVIRONMENT);
    expect(resolveEnvironment('')).toBe(DEFAULT_ENVIRONMENT);
    expect(resolveEnvironment('   ')).toBe(DEFAULT_ENVIRONMENT);
  });

  it('conserva el valor recibido sin normalizarlo a un catálogo fijo', () => {
    expect(resolveEnvironment('production')).toBe('production');
    expect(resolveEnvironment(' development ')).toBe('development');
  });

  it('resuelve NODE_ENV desde el objeto de entorno recibido', () => {
    expect(resolveEnvironmentFromEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(resolveEnvironmentFromEnvironment({})).toBe(DEFAULT_ENVIRONMENT);
  });
});
