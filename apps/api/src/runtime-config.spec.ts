import { DEFAULT_CORS_ORIGIN, DEFAULT_PORT, resolveRuntimeConfig } from './runtime-config';

describe('resolveRuntimeConfig', () => {
  it('usa los valores por defecto cuando PORT y CORS_ORIGIN están ausentes', () => {
    const config = resolveRuntimeConfig({});

    expect(config).toEqual({ port: DEFAULT_PORT, corsOrigin: DEFAULT_CORS_ORIGIN });
  });

  it('acepta un PORT numérico válido dentro del rango permitido', () => {
    const config = resolveRuntimeConfig({ PORT: '8080' });

    expect(config.port).toBe(8080);
  });

  it.each(['abc', '3000.5', '0', '65536', '-1', ''])(
    'rechaza un PORT inválido: "%s"',
    (invalidPort) => {
      expect(() => resolveRuntimeConfig({ PORT: invalidPort })).toThrow(
        /La variable de entorno PORT debe ser un número entero entre 1 y 65535/,
      );
    },
  );

  it('acepta un CORS_ORIGIN http(s) válido sin ruta, query ni fragmento', () => {
    const config = resolveRuntimeConfig({ CORS_ORIGIN: 'https://timbo.example.com' });

    expect(config.corsOrigin).toBe('https://timbo.example.com');
  });

  it.each([
    'not-a-url',
    'ftp://example.com',
    'http://localhost:5173/app',
    'http://localhost:5173?x=1',
    'http://localhost:5173#section',
  ])('rechaza un CORS_ORIGIN inválido: "%s"', (invalidOrigin) => {
    expect(() => resolveRuntimeConfig({ CORS_ORIGIN: invalidOrigin })).toThrow(
      /La variable de entorno CORS_ORIGIN debe ser un origen HTTP o HTTPS válido/,
    );
  });
});
