export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export function resolveApiBaseUrl(rawApiBaseUrl: string | undefined): string {
  if (rawApiBaseUrl === undefined) {
    return DEFAULT_API_BASE_URL;
  }

  const invalidBaseUrlMessage = `La variable de entorno VITE_API_BASE_URL debe ser un origen HTTP o HTTPS válido, sin ruta, parámetros ni fragmento (valor recibido: "${rawApiBaseUrl}").`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawApiBaseUrl);
  } catch {
    throw new Error(invalidBaseUrlMessage);
  }

  const isHttpProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  const hasExtraSegments =
    parsedUrl.pathname !== '/' ||
    parsedUrl.search !== '' ||
    parsedUrl.hash !== '' ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== '';

  if (!isHttpProtocol || hasExtraSegments) {
    throw new Error(invalidBaseUrlMessage);
  }

  return parsedUrl.origin;
}
