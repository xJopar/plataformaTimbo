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

  it('obtiene un chiste en inglés desde icanhazdadjoke', async () => {
    fetchImplementation.mockResolvedValueOnce(
      jsonResponse({ id: 'joke-a', joke: 'What is brown and sticky? A stick.' }),
    );

    await expect(service.getJoke()).resolves.toEqual({
      id: 'joke-a',
      originalText: 'What is brown and sticky? A stick.',
    });

    const dadJokeCall = fetchImplementation.mock.calls[0];
    expect(dadJokeCall?.[0]).toBe('https://icanhazdadjoke.com/');
    expect(dadJokeCall?.[1]?.headers).toEqual(
      expect.objectContaining({ Accept: 'application/json' }),
    );
    expect(dadJokeCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('falla explícitamente cuando el proveedor de chistes responde con un formato inesperado', async () => {
    fetchImplementation.mockResolvedValueOnce(jsonResponse({ id: 'joke-a' }));

    await expect(service.getJoke()).rejects.toBeInstanceOf(HelloWorldProviderUnavailableError);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('preserva como causa una falla de red del proveedor', async () => {
    const networkError = new Error('network unavailable');
    fetchImplementation.mockRejectedValueOnce(networkError);

    await expect(service.getJoke()).rejects.toEqual(
      expect.objectContaining({
        name: 'HelloWorldProviderUnavailableError',
        cause: networkError,
      }),
    );
  });
});
