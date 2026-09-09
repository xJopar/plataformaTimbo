export interface GatewayConfig {
  port: number;
  apiInternalOrigin: string;
}

export const DEFAULT_PORT = 4173;

const MIN_PORT = 1;
const MAX_PORT = 65535;

function resolvePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const isPositiveInteger = /^\d+$/.test(rawPort);
  const parsedPort = Number(rawPort);

  if (!isPositiveInteger || parsedPort < MIN_PORT || parsedPort > MAX_PORT) {
    throw new Error(
      `La variable de entorno PORT debe ser un número entero entre ${String(MIN_PORT)} y ${String(MAX_PORT)} (valor recibido: "${rawPort}").`,
    );
  }

  return parsedPort;
}

export function resolveApiInternalOrigin(rawOrigin: string | undefined): string {
  const invalidOriginMessage =
    'La variable de entorno API_INTERNAL_ORIGIN es obligatoria y debe ser un origen HTTP o HTTPS válido, sin ruta, parámetros ni fragmento.';

  if (rawOrigin === undefined || rawOrigin.trim() === '') {
    throw new Error(invalidOriginMessage);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawOrigin);
  } catch {
    throw new Error(invalidOriginMessage);
  }

  const isHttpProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  const hasExtraSegments =
    parsedUrl.pathname !== '/' || parsedUrl.search !== '' || parsedUrl.hash !== '';

  if (!isHttpProtocol || hasExtraSegments) {
    throw new Error(invalidOriginMessage);
  }

  return parsedUrl.origin;
}

/**
 * Se resuelve antes de crear el servidor HTTP para que una configuración inválida
 * aborte el arranque del gateway con un mensaje claro, en vez de escuchar peticiones
 * sin saber a qué upstream reenviar `/api`.
 */
export function resolveGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    port: resolvePort(env.PORT),
    apiInternalOrigin: resolveApiInternalOrigin(env.API_INTERNAL_ORIGIN),
  };
}
