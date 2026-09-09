import { createStartupFailureDiagnostic } from './startup-failure-diagnostic';

const TEST_DATABASE_URL = 'postgresql://user:password@localhost:5432/timbo';

class BootstrapDatabaseError extends Error {
  public readonly code = 'P1001';
}

describe('createStartupFailureDiagnostic', () => {
  it('conserva contexto técnico y redacta DATABASE_URL y valores sensibles', () => {
    const error = new BootstrapDatabaseError(
      `No se pudo conectar a ${TEST_DATABASE_URL}; Authorization: Bearer test-token; password=test-password`,
    );
    error.stack = `BootstrapDatabaseError: ${TEST_DATABASE_URL}\nAuthorization: Bearer test-token\npassword=test-password`;

    const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);
    const serializedDiagnostic = JSON.stringify(diagnostic);

    expect(diagnostic).toMatchObject({
      event: 'api.bootstrap.failed',
      operation: 'bootstrap',
      name: 'Error',
      code: 'P1001',
    });
    expect(diagnostic.message).toContain('[DATABASE_URL REDACTED]');
    expect(diagnostic.stack).toContain('[DATABASE_URL REDACTED]');
    expect(serializedDiagnostic).not.toContain(TEST_DATABASE_URL);
    expect(serializedDiagnostic).not.toContain('test-token');
    expect(serializedDiagnostic).not.toContain('test-password');
  });

  it('diagnostica valores no Error sin serializarlos', () => {
    const diagnostic = createStartupFailureDiagnostic({ code: 'E_BOOTSTRAP', token: 'test-token' });

    expect(diagnostic).toEqual({
      timestamp: expect.any(String) as string,
      level: 'error',
      service: 'api',
      environment: expect.any(String) as string,
      event: 'api.bootstrap.failed',
      operation: 'bootstrap',
      name: 'NonErrorThrown',
      code: 'E_BOOTSTRAP',
      message: 'Se lanzó un valor no Error de tipo object.',
    });
  });

  it('expone el mismo contrato base (timestamp/level/service/environment) que api.request.completed y api.request.failed', () => {
    const diagnostic = createStartupFailureDiagnostic(new Error('fallo de arranque'));

    expect(diagnostic.level).toBe('error');
    expect(diagnostic.service).toBe('api');
    expect(typeof diagnostic.environment).toBe('string');
    expect(diagnostic.environment.length).toBeGreaterThan(0);
    expect(() => new Date(diagnostic.timestamp).toISOString()).not.toThrow();
    expect(new Date(diagnostic.timestamp).toISOString()).toBe(diagnostic.timestamp);
  });

  it('redacta claves sensibles compuestas y JSON sin perder sus claves ni límites', () => {
    const sensitiveValues = [
      'token-should-redact',
      'secret-should-redact',
      'bearer-should-redact',
      'password-should-redact',
      'key-should-redact',
      'refresh-should-redact',
      'cookie-should-redact',
      'proxy-should-redact',
      'cookie-value-should-redact',
      'plain-token-should-redact',
      'plain-secret-should-redact',
    ];
    const message = [
      'access_token=token-should-redact, siguiente=visible',
      'client_secret=secret-should-redact} contexto visible',
      'id_token=token-should-redact\ncontinuacion visible',
      '{"authorization":"Bearer bearer-should-redact"}',
      '{"password":"password-should-redact"}',
      '{"api_key":"key-should-redact"}',
      'refresh_token=refresh-should-redact, fin',
      'set-cookie=cookie-should-redact\nfin',
      'proxyAuthorization: Bearer proxy-should-redact, fin',
      'cookie=cookie-value-should-redact, fin',
      'token=plain-token-should-redact, fin',
      'secret=plain-secret-should-redact, fin',
    ].join(' | ');
    const error = new Error(message);
    error.stack = `Error: ${message}`;

    const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);
    const serializedDiagnostic = JSON.stringify(diagnostic);

    for (const sensitiveValue of sensitiveValues) {
      expect(serializedDiagnostic).not.toContain(sensitiveValue);
    }

    expect(diagnostic.message).toContain('access_token=[REDACTED], siguiente=visible');
    expect(diagnostic.message).toContain('client_secret=[REDACTED]} contexto visible');
    expect(diagnostic.message).toContain('id_token=[REDACTED]\ncontinuacion visible');
    expect(diagnostic.message).toContain('{"authorization":"[REDACTED]"}');
    expect(diagnostic.message).toContain('{"password":"[REDACTED]"}');
    expect(diagnostic.message).toContain('{"api_key":"[REDACTED]"}');
    expect(diagnostic.stack).toContain('set-cookie=[REDACTED]\nfin');
  });

  it.each([
    ['session_token=session-token-should-redact, texto posterior', 'session-token-should-redact'],
    ['oauthToken=oauth-token-should-redact} texto posterior', 'oauth-token-should-redact'],
    ['db-password=db-password-should-redact\ntexto posterior', 'db-password-should-redact'],
    ['x_api_key="api-key-should-redact"] texto posterior', 'api-key-should-redact'],
  ])('redacta sufijos sensibles con prefijos arbitrarios: %s', (input, sensitiveValue) => {
    const error = new Error(input);
    error.stack = `Error: ${input}`;

    const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);
    const serializedDiagnostic = JSON.stringify(diagnostic);
    const expectedInput = input.replace(sensitiveValue, '[REDACTED]');

    expect(serializedDiagnostic).not.toContain(sensitiveValue);
    expect(diagnostic.message).toBe(expectedInput);
    expect(diagnostic.stack).toContain(expectedInput);
  });

  it('preserva claves no sensibles que sólo contienen términos sensibles', () => {
    const input = 'tokenCount=3, passwordLength=12, secretion=normal, api_key_count=4';
    const error = new Error(input);
    error.stack = `Error: ${input}`;

    const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);

    expect(diagnostic.message).toBe(input);
    expect(diagnostic.stack).toContain(input);
  });

  it.each([
    ['details={"session_token":"nested-session-secret"}', 'nested-session-secret'],
    ['payload={"oauthToken":"nested-oauth-secret"}', 'nested-oauth-secret'],
    ['headers=[{"x_api_key":"nested-key-secret"}]', 'nested-key-secret'],
    ['details={"authorization":"Bearer nested-bearer-secret"}', 'nested-bearer-secret'],
    [
      'details={"public_before":1,"session_token":"nested-with-context-secret","public_after":2}',
      'nested-with-context-secret',
    ],
  ])('redacta asignaciones sensibles anidadas: %s', (input, sensitiveValue) => {
    const error = new Error(input);
    error.stack = `Error: ${input}`;

    const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);
    const serializedDiagnostic = JSON.stringify(diagnostic);

    expect(serializedDiagnostic).not.toContain(sensitiveValue);
    expect(diagnostic.message).toContain('[REDACTED]');
    expect(diagnostic.stack).toContain('[REDACTED]');
    if (input.includes('public_before')) {
      expect(diagnostic.message).toContain('"public_before":1');
      expect(diagnostic.message).toContain('"public_after":2');
    }
  });

  it('preserva URLs y texto con dos puntos sin recursión ni redacción', () => {
    const input = 'details=https://example.test:8443/path, etiqueta=visible:con-contexto';
    const error = new Error(input);
    error.stack = `Error: ${input}`;

    const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);

    expect(diagnostic.message).toBe(input);
    expect(diagnostic.stack).toContain(input);
  });

  it.each([
    ['token="unterminated-token-secret', 'unterminated-token-secret', 'token="[REDACTED]'],
    [
      "password='unterminated-password-secret",
      'unterminated-password-secret',
      "password='[REDACTED]",
    ],
    [
      'details={"session_token":"unterminated-nested-secret',
      'unterminated-nested-secret',
      'details={"session_token":"[REDACTED]',
    ],
    [
      'authorization="Bearer unterminated-bearer-secret',
      'unterminated-bearer-secret',
      'authorization="[REDACTED]',
    ],
  ])(
    'redacta valores sensibles con comillas sin cierre: %s',
    (firstLine, sensitiveValue, expectedFirstLine) => {
      const followingLine = 'siguiente=visible';
      const input = `${firstLine}\n${followingLine}`;
      const error = new Error(input);
      error.stack = `Error: ${input}`;

      const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);
      const serializedDiagnostic = JSON.stringify(diagnostic);

      expect(serializedDiagnostic).not.toContain(sensitiveValue);
      expect(diagnostic.message).toContain(`${expectedFirstLine}\n${followingLine}`);
      expect(diagnostic.stack).toContain(`${expectedFirstLine}\n${followingLine}`);
    },
  );

  it('preserva claves no sensibles anidadas', () => {
    const input = 'details={"tokenCount":3,"api_key_count":4}';
    const error = new Error(input);
    error.stack = `Error: ${input}`;

    const diagnostic = createStartupFailureDiagnostic(error, TEST_DATABASE_URL);

    expect(diagnostic.message).toBe(input);
    expect(diagnostic.stack).toContain(input);
  });
});
