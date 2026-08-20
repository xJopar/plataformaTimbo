import { createServer, type Server } from 'node:http';
import { proxyApiRequest } from './proxy-handler.js';
import { createStaticHandler } from './static-handler.js';

const API_PATH_PREFIX = '/api';

function isApiRequest(url: string | undefined): boolean {
  return url !== undefined && (url === API_PATH_PREFIX || url.startsWith(`${API_PATH_PREFIX}/`));
}

export interface GatewayServerConfig {
  apiInternalOrigin: string;
  staticDir: string;
  // Sólo para pruebas: permite forzar un timeout corto sin exponer una variable de
  // entorno nueva. En producción se usa el valor por defecto de proxy-handler.ts.
  upstreamTimeoutMs?: number;
}

/**
 * Único punto de entrada HTTP del servicio Web productivo: rutas bajo `/api` se
 * reenvían al upstream configurado; el resto sirve la SPA. Nunca elige un upstream
 * a partir de la petición entrante, por lo que no puede convertirse en proxy abierto.
 */
export function createGatewayServer(config: GatewayServerConfig): Server {
  const handleStaticRequest = createStaticHandler(config.staticDir);

  return createServer((request, response) => {
    if (isApiRequest(request.url)) {
      proxyApiRequest(request, response, config.apiInternalOrigin, {
        upstreamTimeoutMs: config.upstreamTimeoutMs,
      });
      return;
    }

    handleStaticRequest(request, response).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          event: 'web.gateway.static_failed',
          operation: 'static',
          method: request.method,
          name: error instanceof Error ? error.name : 'NonErrorThrown',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' });
      }
      response.end();
    });
  });
}
