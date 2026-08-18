import {
  DEFAULT_CORS_ORIGIN,
  DEFAULT_PORT,
  resolveDatabaseUrl,
  resolveRuntimeConfig,
} from './runtime-config';

const TEST_DATABASE_URL = 'postgresql://user:password@localhost:5432/timbo';

describe('resolveRuntimeConfig', () => {
  it('usa los valores por defecto cuando PORT y CORS_ORIGIN estan ausentes', () => {
    const config = resolveRuntimeConfig({ DATABASE_URL: TEST_DATABASE_URL });

    expect(config).toEqual({
      port: DEFAULT_PORT,
      corsOrigin: DEFAULT_CORS_ORIGIN,
      databaseUrl: TEST_DATABASE_URL,
    });
  });

  it('acepta un PORT numerico valido dentro del rango permitido', () => {
    const config = resolveRuntimeConfig({ PORT: '8080', DATABASE_URL: TEST_DATABASE_URL });

    expect(config.port).toBe(8080);
  });

  it.each(['abc', '3000.5', '0', '65536', '-1', ''])(
    'rechaza un PORT invalido: "%s"',
    (invalidPort) => {
      expect(() =>
        resolveRuntimeConfig({ PORT: invalidPort, DATABASE_URL: TEST_DATABASE_URL }),
      ).toThrow(/La variable de entorno PORT debe ser un/);
    },
  );

  it('acepta un CORS_ORIGIN http(s) valido sin ruta, query ni fragmento', () => {
    const config = resolveRuntimeConfig({
      CORS_ORIGIN: 'https://timbo.example.com',
      DATABASE_URL: TEST_DATABASE_URL,
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
      resolveRuntimeConfig({ CORS_ORIGIN: invalidOrigin, DATABASE_URL: TEST_DATABASE_URL }),
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
});
