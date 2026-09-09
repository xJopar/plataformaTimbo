import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, resolveApiInternalOrigin, resolveGatewayConfig } from './gateway-config.js';

const VALID_ORIGIN = 'http://api.railway.internal:3000';

describe('resolveGatewayConfig', () => {
  it('usa el puerto local por defecto cuando PORT no está definido', () => {
    const config = resolveGatewayConfig({ API_INTERNAL_ORIGIN: VALID_ORIGIN });
    expect(config).toEqual({ port: DEFAULT_PORT, apiInternalOrigin: VALID_ORIGIN });
  });

  it('acepta un PORT numérico válido dentro del rango permitido', () => {
    const config = resolveGatewayConfig({ PORT: '8080', API_INTERNAL_ORIGIN: VALID_ORIGIN });
    expect(config.port).toBe(8080);
  });

  it.each(['abc', '3000.5', '0', '65536', '-1', ''])(
    'rechaza un PORT inválido: "%s"',
    (invalidPort) => {
      expect(() =>
        resolveGatewayConfig({ PORT: invalidPort, API_INTERNAL_ORIGIN: VALID_ORIGIN }),
      ).toThrow(/La variable de entorno PORT debe ser un/);
    },
  );

  it('rechaza la ausencia de API_INTERNAL_ORIGIN', () => {
    expect(() => resolveGatewayConfig({})).toThrow(
      'La variable de entorno API_INTERNAL_ORIGIN es obligatoria',
    );
  });

  it('normaliza un origen HTTP con barra final', () => {
    expect(resolveApiInternalOrigin('http://api.railway.internal:3000/')).toBe(
      'http://api.railway.internal:3000',
    );
  });

  it.each([
    'api.railway.internal',
    'ftp://api.railway.internal:3000',
    'http://api.railway.internal:3000/api',
    'http://api.railway.internal:3000?x=1',
    'http://api.railway.internal:3000#section',
  ])('rechaza un origen inválido: %s', (invalidOrigin) => {
    expect(() => resolveApiInternalOrigin(invalidOrigin)).toThrow(
      'API_INTERNAL_ORIGIN es obligatoria y debe ser un origen HTTP o HTTPS válido',
    );
  });
});
