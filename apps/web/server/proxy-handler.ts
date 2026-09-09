import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { INCOMING_REQUEST_ID_HEADER } from '@timbo/observability';
import { logUpstreamUnavailable, type GatewayRequestContext } from './operational-logger.js';

// Encabezados de un único salto: no tienen sentido reenviados entre el gateway
// y el upstream, que son dos conexiones HTTP independientes.
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function filterHopByHopHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const filteredHeaders: IncomingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      filteredHeaders[name] = value;
    }
  }
  return filteredHeaders;
}

// Tiempo máximo sin actividad del socket upstream (conexión, headers o cuerpo) antes de
// cortarlo. Evita que un upstream conectado pero colgado mantenga la petición indefinidamente.
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;

export interface ProxyApiRequestOptions {
  upstreamTimeoutMs?: number;
}

/**
 * Reenvía una petición `/api/*` al origen interno de la API, preservando método,
 * cuerpo, encabezados y la respuesta (incluido `Set-Cookie`) sin transformarlos.
 * No conoce autenticación ni credenciales: sólo mueve bytes entre dos conexiones HTTP.
 * Propaga el mismo `requestId` que el gateway ya resolvió y devolvió al navegador,
 * para que API observe exactamente ese valor en vez de revalidar uno propio.
 */
export function proxyApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  apiInternalOrigin: string,
  requestContext: GatewayRequestContext,
  options: ProxyApiRequestOptions = {},
): void {
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const upstreamUrl = new URL(request.url ?? '/', apiInternalOrigin);
  const makeUpstreamRequest = upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  const forwardedHeaders = filterHopByHopHeaders(request.headers);
  forwardedHeaders.host = upstreamUrl.host;
  forwardedHeaders[INCOMING_REQUEST_ID_HEADER] = requestContext.requestId;

  const upstreamRequest = makeUpstreamRequest(
    upstreamUrl,
    { method: request.method, headers: forwardedHeaders },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        filterHopByHopHeaders(upstreamResponse.headers),
      );
      upstreamResponse.pipe(response);
    },
  );

  // Corta el socket upstream si queda inactivo (sin conectar, sin headers o sin datos de
  // cuerpo) más de `upstreamTimeoutMs`. `destroy(error)` dispara el 'error' de abajo, que
  // ya sabe responder 502 sin duplicar la respuesta.
  upstreamRequest.setTimeout(upstreamTimeoutMs, () => {
    const timeoutError: NodeJS.ErrnoException = new Error(
      'Tiempo de espera agotado esperando al upstream.',
    );
    timeoutError.code = 'UPSTREAM_TIMEOUT';
    upstreamRequest.destroy(timeoutError);
  });

  upstreamRequest.on('error', (error: NodeJS.ErrnoException) => {
    if (response.writableEnded || response.destroyed) {
      // El cliente ya cortó la conexión (o la respuesta ya se completó): no hay a quién
      // responder ni una falla de upstream real que diagnosticar. Un aborto benigno libera
      // recursos y deja su finalización propia; nunca se inventa una falla de upstream.
      return;
    }

    // Diagnóstico sin cookies, cabeceras ni cuerpo: sólo identifica la falla de conexión,
    // correlacionada por requestId. El código (`ECONNREFUSED`, `UPSTREAM_TIMEOUT`, etc.)
    // distingue indisponibilidad de timeout sin necesitar un evento separado. El origen interno
    // nunca se filtra: el mensaje de conexión de Node suele incluirlo literalmente.
    logUpstreamUnavailable(error, requestContext, apiInternalOrigin);

    if (response.headersSent) {
      response.destroy();
      return;
    }

    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE' }));
  });

  // El cliente cortó la conexión antes de que termináramos de responder (navegación
  // abortada, pestaña cerrada, etc.): liberar el upstream sin escribir nada tardío.
  response.on('close', () => {
    if (response.writableEnded) {
      return;
    }
    upstreamRequest.destroy();
  });

  request.pipe(upstreamRequest);
}
