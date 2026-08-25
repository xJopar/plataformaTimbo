import { describe, expect, it, vi } from 'vitest';
import { MyMemoryTranslationError, translateEnglishToSpanish } from './mymemory-translation';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('translateEnglishToSpanish', () => {
  it('traduce con MyMemory sin clave, cookies ni referrer', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        responseData: { translatedText: 'Un chiste corto.' },
        responseStatus: 200,
      }),
    );

    await expect(translateEnglishToSpanish('A short joke.', fetchImplementation)).resolves.toBe(
      'Un chiste corto.',
    );

    const [requestUrl, requestInit] = fetchImplementation.mock.calls[0] ?? [];
    expect(requestUrl).toBeTypeOf('string');
    if (typeof requestUrl !== 'string') {
      throw new Error('MyMemory no recibió la URL esperada.');
    }
    const parsedUrl = new URL(requestUrl);
    expect(parsedUrl.origin + parsedUrl.pathname).toBe('https://api.mymemory.translated.net/get');
    expect(parsedUrl.searchParams.get('q')).toBe('A short joke.');
    expect(parsedUrl.searchParams.get('langpair')).toBe('en|es');
    expect(parsedUrl.searchParams.has('key')).toBe(false);
    expect(requestInit).toMatchObject({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
  });

  it('rechaza respuestas HTTP y formatos inesperados', async () => {
    const unavailableFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 429 }));
    const malformedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ responseStatus: 200 }));

    await expect(translateEnglishToSpanish('A joke.', unavailableFetch)).rejects.toThrow(
      'HTTP 429',
    );
    await expect(translateEnglishToSpanish('A joke.', malformedFetch)).rejects.toThrow(
      'formato inesperado',
    );
  });

  it('tipa una falla de red y conserva la causa original', async () => {
    const networkError = new TypeError('Failed to fetch');
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(networkError);

    await expect(translateEnglishToSpanish('A joke.', fetchImplementation)).rejects.toMatchObject({
      name: 'MyMemoryTranslationError',
      code: 'MYMEMORY_REQUEST_FAILED',
      cause: networkError,
    } satisfies Partial<MyMemoryTranslationError>);
  });

  it('no envía textos vacíos ni superiores a 500 bytes', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(translateEnglishToSpanish('', fetchImplementation)).rejects.toThrow('límite');
    await expect(translateEnglishToSpanish('a'.repeat(501), fetchImplementation)).rejects.toThrow(
      'límite',
    );
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
