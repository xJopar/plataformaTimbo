import type { IncomingMessage, ServerResponse } from 'node:http';
import serveHandler from 'serve-handler';

const ASSET_PATH_PREFIX = '/assets/';
const NO_CACHE_HEADER = 'no-cache';
const IMMUTABLE_ASSET_CACHE_HEADER = 'public, max-age=31536000, immutable';

function isAssetRequest(url: string | undefined): boolean {
  if (url === undefined) {
    return false;
  }

  return new URL(url, 'http://gateway.local').pathname.startsWith(ASSET_PATH_PREFIX);
}

/**
 * Sirve el build de la SPA y reescribe las rutas de navegación a `index.html`, igual
 * que el `serve --single` que reemplaza. Los assets se excluyen del fallback: si un
 * navegador conserva un `index.html` anterior a un despliegue, el bundle obsoleto
 * debe responder 404 en vez de devolver HTML con estado 200 como si fuera JavaScript.
 * Sólo atiende rutas ajenas a `/api`: el gateway decide eso antes de llamar al handler.
 */
export function createStaticHandler(
  staticDir: string,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async function handleStaticRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const rewrites = isAssetRequest(request.url)
      ? undefined
      : [{ source: '**', destination: '/index.html' }];

    await serveHandler(request, response, {
      public: staticDir,
      rewrites,
      headers: [
        {
          source: 'index.html',
          headers: [{ key: 'Cache-Control', value: NO_CACHE_HEADER }],
        },
        {
          source: 'assets/**',
          headers: [{ key: 'Cache-Control', value: IMMUTABLE_ASSET_CACHE_HEADER }],
        },
      ],
    });
  };
}
