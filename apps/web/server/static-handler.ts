import type { IncomingMessage, ServerResponse } from 'node:http';
import serveHandler from 'serve-handler';

/**
 * Sirve el build de la SPA y reescribe cualquier ruta no encontrada a `index.html`,
 * igual que el `serve --single` que reemplaza. Sólo atiende rutas ajenas a `/api`:
 * el gateway decide eso antes de llamar a este handler.
 */
export function createStaticHandler(
  staticDir: string,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async function handleStaticRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    await serveHandler(request, response, {
      public: staticDir,
      rewrites: [{ source: '**', destination: '/index.html' }],
    });
  };
}
