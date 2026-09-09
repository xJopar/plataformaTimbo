import { describe, expect, it, vi } from 'vitest';
import { ApiHttpError, createSystemApi } from './system';

describe('createSystemApi', () => {
  it('devuelve la respuesta tipada de health cuando la API responde 200', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', timestamp: '2026-08-18T12:00:00.000Z' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const systemApi = createSystemApi('http://localhost:3000', fetchImplementation);

    await expect(systemApi.getHealth()).resolves.toEqual({
      status: 'ok',
      timestamp: '2026-08-18T12:00:00.000Z',
    });
    const calledRequest = fetchImplementation.mock.calls[0]?.[0];
    expect(calledRequest).toMatchObject({
      method: 'GET',
      url: 'http://localhost:3000/api/health',
    });
  });

  it('representa un fallo HTTP como error y conserva un requestId válido', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 503,
        headers: { 'x-request-id': 'request-health-503' },
      }),
    );
    const systemApi = createSystemApi('http://localhost:3000', fetchImplementation);

    let caughtError: unknown;
    try {
      await systemApi.getHealth();
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiHttpError);
    if (!(caughtError instanceof ApiHttpError)) {
      throw new Error('Se esperaba un ApiHttpError.');
    }
    expect(caughtError.status).toBe(503);
    expect(caughtError.requestId).toBe('request-health-503');
  });

  it('propaga un fallo de red', async () => {
    const networkError = new TypeError('Failed to fetch');
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(networkError);
    const systemApi = createSystemApi('http://localhost:3000', fetchImplementation);

    await expect(systemApi.getHealth()).rejects.toBe(networkError);
  });
});
