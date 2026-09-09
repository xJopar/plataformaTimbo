/**
 * Reduce una URL de petición a su ruta registrada, sin query string. Evita que parámetros
 * como `code` o `state` del callback OAuth, u otro dato sensible enviado por query, terminen
 * en los logs operativos.
 */
export function normalizeRequestRoute(rawUrl: string): string {
  const queryIndex = rawUrl.indexOf('?');
  return queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
}
