import { describe, expect, it, vi } from 'vitest';
import { ApiHttpError } from './system';
import { createAuthApi } from './auth';

describe('createAuthApi', () => {
  it('consulta la sesión incluyendo credenciales', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'user-1', corporateEmail: 'persona@timbo.com', displayName: null }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await expect(
      createAuthApi('http://localhost:3000', fetchImplementation).getSession(),
    ).resolves.toMatchObject({
      corporateEmail: 'persona@timbo.com',
    });
    expect(fetchImplementation.mock.calls[0]?.[0]).toMatchObject({ credentials: 'include' });
  });

  it('envía el encabezado CSRF y conserva las credenciales en logout', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    await createAuthApi('http://localhost:3000', fetchImplementation).logout();

    const request = fetchImplementation.mock.calls[0]?.[0];
    if (request === undefined) {
      throw new Error('Se esperaba una solicitud de cierre de sesión.');
    }
    expect(request).toMatchObject({ credentials: 'include' });
    expect(new Request(request).headers.get('x-timbo-csrf')).toBe('1');
  });

  it('expone errores HTTP y la ruta de inicio Google sin datos OAuth', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const auth = createAuthApi('http://localhost:3000', fetchImplementation);

    await expect(auth.getSession()).rejects.toBeInstanceOf(ApiHttpError);
    expect(auth.getGoogleLoginUrl()).toBe('http://localhost:3000/api/auth/google');
  });
});
