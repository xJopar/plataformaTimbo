import { Inject, Injectable } from '@nestjs/common';
import { HelloWorldProviderUnavailableError } from './hello-world.errors';
import { HELLO_WORLD_FETCH } from './hello-world.tokens';

const DAD_JOKE_ENDPOINT = 'https://icanhazdadjoke.com/';
const PROVIDER_TIMEOUT_MILLISECONDS = 8_000;

type FetchImplementation = typeof fetch;

interface DadJokeResponse {
  id: string;
  joke: string;
}

export interface HelloWorldJoke {
  id: string;
  originalText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDadJokeResponse(value: unknown): DadJokeResponse {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.trim() === '' ||
    typeof value.joke !== 'string' ||
    value.joke.trim() === ''
  ) {
    throw new HelloWorldProviderUnavailableError(
      'icanhazdadjoke respondió con un formato inesperado.',
    );
  }

  return { id: value.id, joke: value.joke };
}

@Injectable()
export class HelloWorldService {
  public constructor(
    @Inject(HELLO_WORLD_FETCH) private readonly fetchImplementation: FetchImplementation,
  ) {}

  public async getJoke(): Promise<HelloWorldJoke> {
    const jokeResponse = await this.fetchJson('icanhazdadjoke', DAD_JOKE_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PlataformaTimbo/0.1 (+https://github.com/xJopar/plataformaTimbo)',
      },
    });
    const joke = parseDadJokeResponse(jokeResponse);

    return {
      id: joke.id,
      originalText: joke.joke,
    };
  }

  private async fetchJson(
    providerName: string,
    endpoint: string,
    requestInit: RequestInit,
  ): Promise<unknown> {
    try {
      const response = await this.fetchImplementation(endpoint, {
        ...requestInit,
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
      });
      if (!response.ok) {
        throw new Error(`${providerName} respondió con estado HTTP ${String(response.status)}.`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof HelloWorldProviderUnavailableError) {
        throw error;
      }
      throw new HelloWorldProviderUnavailableError(
        `No fue posible obtener una respuesta válida de ${providerName}.`,
        { cause: error },
      );
    }
  }
}
