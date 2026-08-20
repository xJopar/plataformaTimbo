import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  createGatewayBootstrapFailureDiagnostic,
  logGatewayRequestCompleted,
  logStaticFailed,
  logUpstreamUnavailable,
} from './operational-logger.js';

interface StructuredLog {
  timestamp: string;
  level: string;
  service: string;
  environment: string;
  event: string;
  operation: string;
  [key: string]: unknown;
}

const TEST_API_INTERNAL_ORIGIN = 'http://api.railway.internal:3000';
const TEST_IPV6_API_INTERNAL_ORIGIN = 'http://[::1]:3000';

describe('operational-logger del gateway', () => {
  let consoleLogSpy: MockInstance<typeof console.log>;
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  function lastLog(spy: MockInstance<typeof console.log>): StructuredLog {
    const lastCall = spy.mock.calls.at(-1) as unknown[] | undefined;
    const [serialized] = lastCall ?? [];
    return JSON.parse(serialized as string) as StructuredLog;
  }

  describe('logGatewayRequestCompleted', () => {
    it('emite a stdout con service=web y los campos base cuando el status es exitoso', () => {
      logGatewayRequestCompleted({
        requestId: 'request-a',
        method: 'GET',
        route: '/api/health',
        status: 200,
        durationMs: 4.2,
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const parsed = lastLog(consoleLogSpy);
      expect(parsed).toMatchObject({
        level: 'info',
        service: 'web',
        event: 'web.gateway.request.completed',
        operation: 'request',
        requestId: 'request-a',
        method: 'GET',
        route: '/api/health',
        status: 200,
        durationMs: 4.2,
      });
      expect(typeof parsed.timestamp).toBe('string');
      expect(typeof parsed.environment).toBe('string');
    });

    it('emite a stderr cuando el status es >= 500', () => {
      logGatewayRequestCompleted({
        requestId: 'request-b',
        method: 'GET',
        route: '/api/health',
        status: 502,
        durationMs: 1,
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(lastLog(consoleErrorSpy)).toMatchObject({ level: 'error', status: 502 });
    });
  });

  describe('logUpstreamUnavailable', () => {
    it('correlaciona por requestId y redacta secretos del mensaje de error', () => {
      const error: NodeJS.ErrnoException = new Error(
        'fallo de conexión; Authorization: Bearer secreto-token',
      );
      error.code = 'ECONNREFUSED';

      logUpstreamUnavailable(
        error,
        { requestId: 'request-c', method: 'GET', route: '/api/health' },
        TEST_API_INTERNAL_ORIGIN,
      );

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const parsed = lastLog(consoleErrorSpy);
      expect(parsed).toMatchObject({
        level: 'error',
        service: 'web',
        event: 'web.gateway.upstream_unavailable',
        operation: 'proxy',
        requestId: 'request-c',
        method: 'GET',
        route: '/api/health',
        code: 'ECONNREFUSED',
      });
      expect(JSON.stringify(parsed)).not.toContain('secreto-token');
      expect(parsed.message as string).toContain('[REDACTED]');
    });

    it('distingue un timeout por su código sin un evento separado', () => {
      const timeoutError: NodeJS.ErrnoException = new Error('Tiempo de espera agotado.');
      timeoutError.code = 'UPSTREAM_TIMEOUT';

      logUpstreamUnavailable(
        timeoutError,
        { requestId: 'request-d', method: 'GET', route: '/api/health' },
        TEST_API_INTERNAL_ORIGIN,
      );

      expect(lastLog(consoleErrorSpy)).toMatchObject({
        event: 'web.gateway.upstream_unavailable',
        code: 'UPSTREAM_TIMEOUT',
      });
    });

    it('nunca incluye API_INTERNAL_ORIGIN en message, cause ni stack aunque el error de conexión lo mencione', () => {
      const error: NodeJS.ErrnoException = new Error(
        `connect ECONNREFUSED ${TEST_API_INTERNAL_ORIGIN}`,
        { cause: new Error(`intentando ${TEST_API_INTERNAL_ORIGIN}`) },
      );
      error.code = 'ECONNREFUSED';
      error.stack = `Error: connect ECONNREFUSED ${TEST_API_INTERNAL_ORIGIN}\n    at TCPConnectWrap (${TEST_API_INTERNAL_ORIGIN})`;

      logUpstreamUnavailable(
        error,
        { requestId: 'request-f', method: 'GET', route: '/api/health' },
        TEST_API_INTERNAL_ORIGIN,
      );

      const parsed = lastLog(consoleErrorSpy);
      expect(JSON.stringify(parsed)).not.toContain('api.railway.internal');
      expect(parsed.message).toBe('connect ECONNREFUSED [REDACTED]');
      expect(parsed.cause).toContain('[REDACTED]');
      expect(parsed.stack).toContain('[REDACTED]');
    });

    it('redacta el host:puerto o el hostname resuelto tal como los cita el error real de Node (sin esquema)', () => {
      const numericOrigin = 'http://127.0.0.1:56789';
      const connectionRefusedError: NodeJS.ErrnoException = new Error(
        'connect ECONNREFUSED 127.0.0.1:56789',
      );
      connectionRefusedError.code = 'ECONNREFUSED';

      logUpstreamUnavailable(
        connectionRefusedError,
        { requestId: 'request-h', method: 'GET', route: '/api/health' },
        numericOrigin,
      );

      const connectionRefusedLog = lastLog(consoleErrorSpy);
      expect(connectionRefusedLog.message).toBe('connect ECONNREFUSED [REDACTED]');

      const dnsFailureError: NodeJS.ErrnoException = new Error(
        'getaddrinfo ENOTFOUND api.railway.internal',
      );
      dnsFailureError.code = 'ENOTFOUND';

      logUpstreamUnavailable(
        dnsFailureError,
        { requestId: 'request-i', method: 'GET', route: '/api/health' },
        TEST_API_INTERNAL_ORIGIN,
      );

      const dnsFailureLog = lastLog(consoleErrorSpy);
      expect(dnsFailureLog.message).toBe('getaddrinfo ENOTFOUND [REDACTED]');
    });

    it('redacta un origen IPv6 tal como Node cita la dirección real, sin corchetes y sin dejar el puerto colgado', () => {
      // Node reporta la dirección de conexión IPv6 sin corchetes (`::1:3000`), aunque una URL
      // válida los exija (`[::1]`): ambas formas deben redactarse por completo, sin fragmentos.
      const connectionRefusedError: NodeJS.ErrnoException = new Error(
        'connect ECONNREFUSED ::1:3000',
      );
      connectionRefusedError.code = 'ECONNREFUSED';

      logUpstreamUnavailable(
        connectionRefusedError,
        { requestId: 'request-j', method: 'GET', route: '/api/health' },
        TEST_IPV6_API_INTERNAL_ORIGIN,
      );

      const unbracketedLog = lastLog(consoleErrorSpy);
      expect(unbracketedLog.message).toBe('connect ECONNREFUSED [REDACTED]');
      expect(JSON.stringify(unbracketedLog)).not.toContain('::1');

      const bracketedError: NodeJS.ErrnoException = new Error(
        `no se pudo alcanzar ${TEST_IPV6_API_INTERNAL_ORIGIN}`,
      );
      bracketedError.code = 'ECONNREFUSED';

      logUpstreamUnavailable(
        bracketedError,
        { requestId: 'request-k', method: 'GET', route: '/api/health' },
        TEST_IPV6_API_INTERNAL_ORIGIN,
      );

      const bracketedLog = lastLog(consoleErrorSpy);
      expect(bracketedLog.message).toBe('no se pudo alcanzar [REDACTED]');
      expect(JSON.stringify(bracketedLog)).not.toContain('::1');
    });

    it('no sobre-redacta un IPv4/hostname cuando el origen configurado es IPv6, ni viceversa', () => {
      const unrelatedError = new Error('fallo inesperado a las 10:30:00, sin relación con IPv6');

      logUpstreamUnavailable(
        unrelatedError,
        { requestId: 'request-l', method: 'GET', route: '/api/health' },
        TEST_IPV6_API_INTERNAL_ORIGIN,
      );

      expect(lastLog(consoleErrorSpy).message).toBe(
        'fallo inesperado a las 10:30:00, sin relación con IPv6',
      );
    });

    // `URL.port` queda vacío tanto si el puerto se declaró explícito e igual al por defecto del
    // esquema (`:80`/`:443`) como si no se declaró ningún puerto: en ambos casos la conexión TCP
    // real usa igualmente ese puerto y Node lo cita en su mensaje de error.
    it.each([
      ['IPv6, HTTP, puerto 80 explícito', 'http://[::1]:80', 'connect ECONNREFUSED ::1:80'],
      ['IPv6, HTTP, puerto implícito', 'http://[::1]', 'connect ECONNREFUSED ::1:80'],
      ['IPv6, HTTPS, puerto 443 explícito', 'https://[::1]:443', 'connect ECONNREFUSED ::1:443'],
      ['IPv6, HTTPS, puerto implícito', 'https://[::1]', 'connect ECONNREFUSED ::1:443'],
      [
        'IPv4, HTTP, puerto 80 explícito',
        'http://127.0.0.1:80',
        'connect ECONNREFUSED 127.0.0.1:80',
      ],
      ['IPv4, HTTP, puerto implícito', 'http://127.0.0.1', 'connect ECONNREFUSED 127.0.0.1:80'],
      [
        'IPv4, HTTPS, puerto 443 explícito',
        'https://127.0.0.1:443',
        'connect ECONNREFUSED 127.0.0.1:443',
      ],
      ['IPv4, HTTPS, puerto implícito', 'https://127.0.0.1', 'connect ECONNREFUSED 127.0.0.1:443'],
      [
        'DNS, HTTP, puerto 80 explícito',
        'http://api.railway.internal:80',
        'no se pudo conectar a api.railway.internal:80',
      ],
      [
        'DNS, HTTP, puerto implícito',
        'http://api.railway.internal',
        'no se pudo conectar a api.railway.internal:80',
      ],
      [
        'DNS, HTTPS, puerto 443 explícito',
        'https://api.railway.internal:443',
        'no se pudo conectar a api.railway.internal:443',
      ],
      [
        'DNS, HTTPS, puerto implícito',
        'https://api.railway.internal',
        'no se pudo conectar a api.railway.internal:443',
      ],
    ])(
      '%s: redacta el puerto por defecto del esquema sin dejarlo colgado (%s)',
      (_description, origin, connectionMessage) => {
        const error: NodeJS.ErrnoException = new Error(connectionMessage);
        error.code = 'ECONNREFUSED';

        logUpstreamUnavailable(
          error,
          { requestId: `request-default-port-${origin}`, method: 'GET', route: '/api/health' },
          origin,
        );

        const parsed = lastLog(consoleErrorSpy);
        expect(parsed.message).toBe(connectionMessage.replace(/[^\s]+$/u, '[REDACTED]'));
        expect(parsed.message).not.toContain(':80');
        expect(parsed.message).not.toContain(':443');
      },
    );

    it('no sobre-redacta un host o puerto distinto del configurado con puerto por defecto', () => {
      const unrelatedHostError = new Error('connect ECONNREFUSED 203.0.113.5:80');
      logUpstreamUnavailable(
        unrelatedHostError,
        { requestId: 'request-n', method: 'GET', route: '/api/health' },
        'http://[::1]:80',
      );
      expect(lastLog(consoleErrorSpy).message).toBe('connect ECONNREFUSED 203.0.113.5:80');

      const unrelatedPortError = new Error('reintento programado en 80 segundos');
      logUpstreamUnavailable(
        unrelatedPortError,
        { requestId: 'request-o', method: 'GET', route: '/api/health' },
        'http://127.0.0.1:80',
      );
      expect(lastLog(consoleErrorSpy).message).toBe('reintento programado en 80 segundos');
    });
  });

  describe('logStaticFailed', () => {
    it('correlaciona por requestId y redacta el mensaje del error', () => {
      logStaticFailed(
        new Error('fallo leyendo password=secreto-de-archivo'),
        { requestId: 'request-e', method: 'GET', route: '/assets/app.js' },
        TEST_API_INTERNAL_ORIGIN,
      );

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const parsed = lastLog(consoleErrorSpy);
      expect(parsed).toMatchObject({
        level: 'error',
        service: 'web',
        event: 'web.gateway.static_failed',
        operation: 'static',
        requestId: 'request-e',
        route: '/assets/app.js',
      });
      expect(JSON.stringify(parsed)).not.toContain('secreto-de-archivo');
    });

    it('nunca incluye API_INTERNAL_ORIGIN en message, cause ni stack', () => {
      const error = new Error(`fallo sirviendo estático desde ${TEST_API_INTERNAL_ORIGIN}`, {
        cause: new Error(`referencia a ${TEST_API_INTERNAL_ORIGIN}`),
      });
      error.stack = `Error: fallo sirviendo estático desde ${TEST_API_INTERNAL_ORIGIN}`;

      logStaticFailed(
        error,
        { requestId: 'request-g', method: 'GET', route: '/assets/app.js' },
        TEST_API_INTERNAL_ORIGIN,
      );

      const parsed = lastLog(consoleErrorSpy);
      expect(JSON.stringify(parsed)).not.toContain('api.railway.internal');
      expect(parsed.message).toBe('fallo sirviendo estático desde [REDACTED]');
      expect(parsed.cause).toContain('[REDACTED]');
      expect(parsed.stack).toContain('[REDACTED]');
    });

    it('hereda la cobertura de origen IPv6 sin corchetes de deriveOriginRedactionValues', () => {
      logStaticFailed(
        new Error('fallo referenciando ::1:3000'),
        { requestId: 'request-m', method: 'GET', route: '/assets/app.js' },
        TEST_IPV6_API_INTERNAL_ORIGIN,
      );

      expect(lastLog(consoleErrorSpy).message).toBe('fallo referenciando [REDACTED]');
    });

    it('hereda la cobertura del puerto por defecto del esquema (443) de deriveOriginRedactionValues', () => {
      logStaticFailed(
        new Error('fallo referenciando ::1:443'),
        { requestId: 'request-p', method: 'GET', route: '/assets/app.js' },
        'https://[::1]',
      );

      expect(lastLog(consoleErrorSpy).message).toBe('fallo referenciando [REDACTED]');
    });
  });

  describe('createGatewayBootstrapFailureDiagnostic', () => {
    it('expone los mismos campos base que los demás eventos, sin requestId de petición', () => {
      const diagnostic = createGatewayBootstrapFailureDiagnostic(
        new Error('PORT inválido; token=secreto-arranque'),
        TEST_API_INTERNAL_ORIGIN,
      );

      expect(diagnostic).toMatchObject({
        level: 'error',
        service: 'web',
        event: 'web.gateway.bootstrap.failed',
        operation: 'bootstrap',
        name: 'Error',
      });
      expect(typeof diagnostic.timestamp).toBe('string');
      expect(typeof diagnostic.environment).toBe('string');
      expect('requestId' in diagnostic).toBe(false);
      expect(JSON.stringify(diagnostic)).not.toContain('secreto-arranque');
    });

    it('nunca incluye API_INTERNAL_ORIGIN en message, cause ni stack', () => {
      const error = new Error(`no se pudo resolver ${TEST_API_INTERNAL_ORIGIN}`, {
        cause: new Error(`DNS para ${TEST_API_INTERNAL_ORIGIN}`),
      });
      error.stack = `Error: no se pudo resolver ${TEST_API_INTERNAL_ORIGIN}`;

      const diagnostic = createGatewayBootstrapFailureDiagnostic(error, TEST_API_INTERNAL_ORIGIN);

      expect(JSON.stringify(diagnostic)).not.toContain('api.railway.internal');
      expect(diagnostic.message).toBe('no se pudo resolver [REDACTED]');
      expect(diagnostic.cause).toContain('[REDACTED]');
      expect(diagnostic.stack).toContain('[REDACTED]');
    });

    it('un API_INTERNAL_ORIGIN ausente o vacío no sobre-redacta ni rompe el diagnóstico de arranque', () => {
      const error = new Error('PORT debe ser un número entero');

      expect(createGatewayBootstrapFailureDiagnostic(error, undefined).message).toBe(
        'PORT debe ser un número entero',
      );
      expect(createGatewayBootstrapFailureDiagnostic(error, '').message).toBe(
        'PORT debe ser un número entero',
      );
    });

    it('hereda la cobertura de origen IPv6 sin corchetes de deriveOriginRedactionValues', () => {
      const diagnostic = createGatewayBootstrapFailureDiagnostic(
        new Error('connect ECONNREFUSED ::1:3000'),
        TEST_IPV6_API_INTERNAL_ORIGIN,
      );

      expect(diagnostic.message).toBe('connect ECONNREFUSED [REDACTED]');
    });

    it('hereda la cobertura del puerto por defecto del esquema (80) de deriveOriginRedactionValues', () => {
      const diagnostic = createGatewayBootstrapFailureDiagnostic(
        new Error('connect ECONNREFUSED ::1:80'),
        'http://[::1]',
      );

      expect(diagnostic.message).toBe('connect ECONNREFUSED [REDACTED]');
    });
  });
});
