import { buildErrorDiagnosticFields } from '@timbo/observability';

const SERVICE_NAME = 'web';
const UNEXPECTED_FAILURE_STATUS_THRESHOLD = 500;
const DEFAULT_ENVIRONMENT = 'development';

export interface GatewayRequestContext {
  requestId: string;
  method: string;
  route: string;
}

export interface GatewayRequestCompletionFields extends GatewayRequestContext {
  status: number;
  durationMs: number;
}

type OperationalLogLevel = 'info' | 'error';

/**
 * `NODE_ENV` es opcional y no bloquea el arranque: sólo identifica el entorno en los logs
 * operativos estructurados, igual que en la API (`resolveEnvironmentFromEnvironment`). No se
 * extrae al paquete compartido porque el ticket sólo confirma requestId, ruta, redacción y
 * campos de diagnóstico como funciones puras comunes.
 */
function resolveEnvironment(): string {
  const trimmedEnvironment = process.env.NODE_ENV?.trim();
  return trimmedEnvironment === undefined || trimmedEnvironment === ''
    ? DEFAULT_ENVIRONMENT
    : trimmedEnvironment;
}

function write(level: OperationalLogLevel, payload: Record<string, unknown>): void {
  const serializedPayload = JSON.stringify(payload);

  if (level === 'error') {
    console.error(serializedPayload);
  } else {
    console.log(serializedPayload);
  }
}

// `URL.port` queda vacío cuando el puerto coincide con el de por defecto del esquema, pero la
// conexión TCP real sí lo usa y Node lo cita igual que un puerto explícito.
const DEFAULT_PORT_BY_PROTOCOL: Record<string, string> = {
  'http:': '80',
  'https:': '443',
};

/**
 * Los mensajes de error reales de Node (`ECONNREFUSED`, `ENOTFOUND`, etc.) casi nunca citan el
 * origen completo con esquema: citan el `host` (`hostname:puerto`) o el `hostname` resuelto. Dos
 * particularidades de esos mensajes exigen derivar más formas que el valor tal como está
 * declarado en la variable de entorno:
 *
 * - Para IPv6, una URL válida exige corchetes (`[::1]`), pero Node reporta la dirección sin
 *   ellos (`::1`, `::1:3000` — así lo hace incluso siendo ambiguo con el propio puerto).
 * - Si el puerto configurado es el por defecto del esquema (80 en HTTP, 443 en HTTPS) o no se
 *   declaró, `URL.port`/`URL.host` lo omiten por normalización — pero la conexión TCP real sí
 *   usa ese puerto y Node lo cita igual que uno explícito.
 *
 * Se deriva el puerto efectivo (explícito o el por defecto del esquema) y se combina con las
 * formas con/sin corchetes del hostname, en orden de la más específica a la más corta
 * (`host:puerto` con y sin corchetes, luego el hostname solo con y sin corchetes), para que
 * redactar una coincidencia larga no deje un fragmento del puerto sin redactar.
 */
function deriveOriginRedactionValues(apiInternalOrigin: string | undefined): string[] {
  if (apiInternalOrigin === undefined || apiInternalOrigin === '') {
    return [];
  }

  try {
    const parsedOrigin = new URL(apiInternalOrigin);
    const unbracketedHostname = parsedOrigin.hostname.replace(/^\[|\]$/g, '');
    const effectivePort =
      parsedOrigin.port === ''
        ? DEFAULT_PORT_BY_PROTOCOL[parsedOrigin.protocol]
        : parsedOrigin.port;

    const bracketedHostWithPort =
      effectivePort === undefined
        ? parsedOrigin.hostname
        : `${parsedOrigin.hostname}:${effectivePort}`;
    const unbracketedHostWithPort =
      effectivePort === undefined ? unbracketedHostname : `${unbracketedHostname}:${effectivePort}`;

    return [
      ...new Set([
        apiInternalOrigin,
        bracketedHostWithPort,
        unbracketedHostWithPort,
        parsedOrigin.hostname,
        unbracketedHostname,
      ]),
    ];
  } catch {
    return [apiInternalOrigin];
  }
}

function baseFields(operation: string): {
  timestamp: string;
  service: string;
  environment: string;
  operation: string;
} {
  return {
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    environment: resolveEnvironment(),
    operation,
  };
}

/**
 * Única finalización estructurada por petición del gateway (API reenviada, estática, 502 o
 * cierre anticipado del cliente), sin importar el resultado. El llamador garantiza que se
 * invoque exactamente una vez por petición mediante una guarda idempotente en `finish`/`close`.
 */
export function logGatewayRequestCompleted(fields: GatewayRequestCompletionFields): void {
  const level: OperationalLogLevel =
    fields.status >= UNEXPECTED_FAILURE_STATUS_THRESHOLD ? 'error' : 'info';

  write(level, {
    ...baseFields('request'),
    level,
    event: 'web.gateway.request.completed',
    requestId: fields.requestId,
    method: fields.method,
    route: fields.route,
    status: fields.status,
    durationMs: fields.durationMs,
  });
}

/**
 * Diagnóstico de upstream indisponible o agotado por timeout, correlacionado por requestId.
 * El código del error (`ECONNREFUSED`, `UPSTREAM_TIMEOUT`, etc.) distingue el motivo sin
 * necesitar un evento separado para cada caso. `apiInternalOrigin` es el valor server-only ya
 * resuelto por el gateway: se entrega explícito al saneador puro, que nunca lee `process.env`.
 */
export function logUpstreamUnavailable(
  error: unknown,
  context: GatewayRequestContext,
  apiInternalOrigin: string,
): void {
  write('error', {
    ...baseFields('proxy'),
    level: 'error',
    event: 'web.gateway.upstream_unavailable',
    requestId: context.requestId,
    method: context.method,
    route: context.route,
    ...buildErrorDiagnosticFields(error, undefined, deriveOriginRedactionValues(apiInternalOrigin)),
  });
}

/**
 * Diagnóstico de fallo del servidor de estáticos (SPA/assets), correlacionado por requestId.
 * Recibe el mismo `apiInternalOrigin` server-only que los demás emisores para nunca filtrarlo.
 */
export function logStaticFailed(
  error: unknown,
  context: GatewayRequestContext,
  apiInternalOrigin: string,
): void {
  write('error', {
    ...baseFields('static'),
    level: 'error',
    event: 'web.gateway.static_failed',
    requestId: context.requestId,
    method: context.method,
    route: context.route,
    ...buildErrorDiagnosticFields(error, undefined, deriveOriginRedactionValues(apiInternalOrigin)),
  });
}

/**
 * El arranque (`bootstrap()` en start.ts) todavía no tiene petición ni requestId: expone los
 * mismos campos base que los demás eventos del gateway, igual que `api.bootstrap.failed`.
 * `apiInternalOrigin` se lee del entorno crudo en start.ts (la configuración validada puede no
 * existir todavía si el propio arranque falló resolviéndola) y se redacta igual que en los
 * demás emisores.
 */
export function createGatewayBootstrapFailureDiagnostic(
  error: unknown,
  apiInternalOrigin: string | undefined,
): Record<string, unknown> {
  return {
    ...baseFields('bootstrap'),
    level: 'error',
    event: 'web.gateway.bootstrap.failed',
    ...buildErrorDiagnosticFields(error, undefined, deriveOriginRedactionValues(apiInternalOrigin)),
  };
}
