import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportBrowserOperationFailed } from './browser-diagnostics';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reportBrowserOperationFailed', () => {
  it('emite un diagnóstico estructurado, correlacionado y sin query string', () => {
    vi.setSystemTime(new Date('2026-08-25T17:00:00.000Z'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(
      new Error(
        'Authorization=Bearer super-secret para persona@timbo.com al procesar A private joke.',
      ),
      { code: 'PROVIDER_FAILURE' },
    );

    reportBrowserOperationFailed(error, {
      operation: 'hello-world.request-joke',
      method: 'GET',
      route: '/api/applications/hello-world/joke?token=super-secret',
      provider: 'api',
      status: 502,
      requestId: 'request-browser-123',
      sensitiveValues: ['A private joke.'],
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
    const diagnostic: unknown = consoleError.mock.calls[0]?.[0];
    expect(diagnostic).toMatchObject({
      timestamp: '2026-08-25T17:00:00.000Z',
      level: 'error',
      service: 'web',
      runtime: 'browser',
      event: 'web.browser.operation_failed',
      operation: 'hello-world.request-joke',
      method: 'GET',
      route: '/api/applications/hello-world/joke',
      provider: 'api',
      status: 502,
      requestId: 'request-browser-123',
      name: 'Error',
      code: 'PROVIDER_FAILURE',
    });
    const serializedDiagnostic = JSON.stringify(diagnostic);
    expect(serializedDiagnostic).not.toContain('super-secret');
    expect(serializedDiagnostic).not.toContain('persona@timbo.com');
    expect(serializedDiagnostic).not.toContain('A private joke.');
    expect(serializedDiagnostic).toContain('[REDACTED]');
  });

  it('omite un requestId no confiable', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportBrowserOperationFailed(new Error('Fallo controlado.'), {
      operation: 'hello-world.translate-joke',
      method: 'GET',
      route: 'https://api.mymemory.translated.net/get',
      provider: 'mymemory',
      requestId: 'valor con espacios',
    });

    const diagnostic: unknown = consoleError.mock.calls[0]?.[0];
    expect(diagnostic).not.toHaveProperty('requestId');
  });
});
