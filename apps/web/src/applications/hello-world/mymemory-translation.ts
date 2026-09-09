const TRANSLATION_ENDPOINT = 'https://api.mymemory.translated.net/get';
const PROVIDER_TIMEOUT_MILLISECONDS = 8_000;
const MAXIMUM_TRANSLATION_QUERY_BYTES = 500;

interface TranslationResponse {
  responseData: { translatedText: string };
  responseStatus: number;
}

export type MyMemoryTranslationErrorCode =
  | 'MYMEMORY_INVALID_INPUT'
  | 'MYMEMORY_REQUEST_FAILED'
  | 'MYMEMORY_HTTP_ERROR'
  | 'MYMEMORY_INVALID_RESPONSE';

export class MyMemoryTranslationError extends Error {
  constructor(
    readonly code: MyMemoryTranslationErrorCode,
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'MyMemoryTranslationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTranslationResponse(value: unknown): TranslationResponse {
  if (
    !isRecord(value) ||
    value.responseStatus !== 200 ||
    !isRecord(value.responseData) ||
    typeof value.responseData.translatedText !== 'string' ||
    value.responseData.translatedText.trim() === ''
  ) {
    throw new MyMemoryTranslationError(
      'MYMEMORY_INVALID_RESPONSE',
      'MyMemory respondió con un formato inesperado.',
    );
  }

  return {
    responseData: { translatedText: value.responseData.translatedText },
    responseStatus: value.responseStatus,
  };
}

export async function translateEnglishToSpanish(
  originalText: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<string> {
  if (
    originalText.trim() === '' ||
    new TextEncoder().encode(originalText).byteLength > MAXIMUM_TRANSLATION_QUERY_BYTES
  ) {
    throw new MyMemoryTranslationError(
      'MYMEMORY_INVALID_INPUT',
      'El texto no cumple el límite admitido por MyMemory.',
    );
  }

  const query = new URLSearchParams({ q: originalText, langpair: 'en|es' });
  let response: Response;
  try {
    response = await fetchImplementation(`${TRANSLATION_ENDPOINT}?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
    });
  } catch (error: unknown) {
    throw new MyMemoryTranslationError(
      'MYMEMORY_REQUEST_FAILED',
      'No fue posible comunicarse con MyMemory.',
      undefined,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new MyMemoryTranslationError(
      'MYMEMORY_HTTP_ERROR',
      `MyMemory respondió con estado HTTP ${String(response.status)}.`,
      response.status,
    );
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error: unknown) {
    throw new MyMemoryTranslationError(
      'MYMEMORY_INVALID_RESPONSE',
      'MyMemory respondió con un cuerpo JSON inválido.',
      response.status,
      { cause: error },
    );
  }

  const translation = parseTranslationResponse(responseBody);
  return translation.responseData.translatedText;
}
