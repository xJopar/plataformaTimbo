const TRANSLATION_ENDPOINT = 'https://api.mymemory.translated.net/get';
const PROVIDER_TIMEOUT_MILLISECONDS = 8_000;
const MAXIMUM_TRANSLATION_QUERY_BYTES = 500;

interface TranslationResponse {
  responseData: { translatedText: string };
  responseStatus: number;
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
    throw new Error('MyMemory respondió con un formato inesperado.');
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
    throw new Error('El texto no cumple el límite admitido por MyMemory.');
  }

  const query = new URLSearchParams({ q: originalText, langpair: 'en|es' });
  const response = await fetchImplementation(`${TRANSLATION_ENDPOINT}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
  });
  if (!response.ok) {
    throw new Error(`MyMemory respondió con estado HTTP ${String(response.status)}.`);
  }

  const translation = parseTranslationResponse(await response.json());
  return translation.responseData.translatedText;
}
