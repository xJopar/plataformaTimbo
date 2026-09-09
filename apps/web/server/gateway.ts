import { createServer, type Server } from 'node:http';
import {
  INCOMING_REQUEST_ID_HEADER,
  RESPONSE_REQUEST_ID_HEADER,
  normalizeRequestRoute,
  resolveRequestId,
} from '@timbo/observability';
import { logGatewayRequestCompleted, logStaticFailed } from './operational-logger.js';
import { proxyApiRequest } from './proxy-handler.js';
import { createStaticHandler } from './static-handler.js';

const API_PATH_PREFIX = '/api';
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

function isApiRequest(url: string | undefined): boolean {
  return url !== undefined && (url === API_PATH_PREFIX || url.startsWith(`${API_PATH_PREFIX}/`));
}

function getIncomingRequestId(headerValue: string | string[] | undefined): string | undefined {
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
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
 *
 * Resuelve el `requestId` antes de decidir API/SPA para que ambos caminos —y sus
 * diagnósticos— compartan la misma correlación, y emite exactamente una finalización
 * por petición (éxito, estática, 502 o cierre anticipado del cliente).
 */
export function createGatewayServer(config: GatewayServerConfig): Server {
  const handleStaticRequest = createStaticHandler(config.staticDir);

  return createServer((request, response) => {
    const requestId = resolveRequestId(
      getIncomingRequestId(request.headers[INCOMING_REQUEST_ID_HEADER]),
    );
    response.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);

    const method = request.method ?? 'GET';
    const route = normalizeRequestRoute(request.url ?? '/');
    const requestContext = { requestId, method, route };
    const startedAt = process.hrtime.bigint();
    let hasLoggedCompletion = false;

    // `close` cubre un aborto de cliente que nunca dispara `finish` (y también puede dispararse
    // después de un `finish` normal); la guarda evita duplicar la finalización cuando ambos
    // eventos ocurren para la misma respuesta.
    const logCompletionOnce = (): void => {
      if (hasLoggedCompletion) {
        return;
      }
      hasLoggedCompletion = true;

      const durationMs = Number(process.hrtime.bigint() - startedAt) / NANOSECONDS_PER_MILLISECOND;
      logGatewayRequestCompleted({ ...requestContext, status: response.statusCode, durationMs });
    };

    response.once('finish', logCompletionOnce);
    response.once('close', logCompletionOnce);

    if (isApiRequest(request.url)) {
      proxyApiRequest(request, response, config.apiInternalOrigin, requestContext, {
        upstreamTimeoutMs: config.upstreamTimeoutMs,
      });
      return;
    }

    handleStaticRequest(request, response).catch((error: unknown) => {
      logStaticFailed(error, requestContext, config.apiInternalOrigin);
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' });
      }
      response.end();
    });
  });
}
