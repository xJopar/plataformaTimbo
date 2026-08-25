import { HelloWorldProviderUnavailableError } from './hello-world.errors';
import { HelloWorldService } from './hello-world.service';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HelloWorldService', () => {
  const fetchImplementation = jest.fn() as jest.MockedFunction<typeof fetch>;
  const service = new HelloWorldService(fetchImplementation);

  beforeEach(() => fetchImplementation.mockReset());

  it('obtiene un chiste en inglés y lo traduce al español sin clave de API', async () => {
    fetchImplementation
      .mockResolvedValueOnce(
        jsonResponse({ id: 'joke-a', joke: 'What is brown and sticky? A stick.' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          responseData: { translatedText: '¿Qué es marrón y pegajoso? Un palo.' },
          responseStatus: 200,
        }),
      );

    await expect(service.getTranslatedJoke()).resolves.toEqual({
      id: 'joke-a',
      originalText: 'What is brown and sticky? A stick.',
      translatedText: '¿Qué es marrón y pegajoso? Un palo.',
    });

    const dadJokeCall = fetchImplementation.mock.calls[0];
    expect(dadJokeCall?.[0]).toBe('https://icanhazdadjoke.com/');
    expect(dadJokeCall?.[1]?.headers).toEqual(
      expect.objectContaining({ Accept: 'application/json' }),
    );
    expect(dadJokeCall?.[1]?.signal).toBeInstanceOf(AbortSignal);

    const translationInput = fetchImplementation.mock.calls[1]?.[0];
    let translationUrl: URL;
    if (typeof translationInput === 'string') {
      translationUrl = new URL(translationInput);
    } else if (translationInput instanceof URL) {
      translationUrl = translationInput;
    } else if (translationInput instanceof Request) {
      translationUrl = new URL(translationInput.url);
    } else {
      throw new Error('No se construyó la petición de traducción esperada.');
    }
    expect(translationUrl.origin + translationUrl.pathname).toBe(
      'https://api.mymemory.translated.net/get',
    );
    expect(translationUrl.searchParams.get('q')).toBe('What is brown and sticky? A stick.');
    expect(translationUrl.searchParams.get('langpair')).toBe('en|es');
    expect(translationUrl.searchParams.has('key')).toBe(false);
  });

  it('falla explícitamente cuando el proveedor de chistes responde con un formato inesperado', async () => {
    fetchImplementation.mockResolvedValueOnce(jsonResponse({ id: 'joke-a' }));

    await expect(service.getTranslatedJoke()).rejects.toBeInstanceOf(
      HelloWorldProviderUnavailableError,
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('falla explícitamente cuando la traducción no está disponible', async () => {
    fetchImplementation
      .mockResolvedValueOnce(jsonResponse({ id: 'joke-a', joke: 'A short joke.' }))
      .mockResolvedValueOnce(
        jsonResponse({ responseData: { translatedText: '' }, responseStatus: 429 }),
      );

    await expect(service.getTranslatedJoke()).rejects.toBeInstanceOf(
      HelloWorldProviderUnavailableError,
    );
  });

  it('no envía a traducción un texto que supera el límite de 500 bytes', async () => {
    fetchImplementation.mockResolvedValueOnce(
      jsonResponse({ id: 'joke-a', joke: 'a'.repeat(501) }),
    );

    await expect(service.getTranslatedJoke()).rejects.toThrow('supera el límite');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('preserva como causa una falla de red del proveedor', async () => {
    const networkError = new Error('network unavailable');
    fetchImplementation.mockRejectedValueOnce(networkError);

    await expect(service.getTranslatedJoke()).rejects.toEqual(
      expect.objectContaining({
        name: 'HelloWorldProviderUnavailableError',
        cause: networkError,
      }),
    );
  });
});
