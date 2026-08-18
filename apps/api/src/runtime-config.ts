export interface RuntimeConfig {
  port: number;
  corsOrigin: string;
}

export const DEFAULT_PORT = 3000;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

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

function resolveCorsOrigin(rawCorsOrigin: string | undefined): string {
  if (rawCorsOrigin === undefined) {
    return DEFAULT_CORS_ORIGIN;
  }

  const invalidOriginMessage = `La variable de entorno CORS_ORIGIN debe ser un origen HTTP o HTTPS válido, sin ruta, parámetros ni fragmento (valor recibido: "${rawCorsOrigin}").`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawCorsOrigin);
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
 * Resuelve y valida la configuración de runtime a partir de variables de entorno.
 * Se ejecuta antes de `NestFactory.create` para que una configuración inválida
 * aborte el arranque con un mensaje claro, en vez de dejar la API arriba con
 * valores incorrectos o fallar más tarde con un error genérico.
 */
export function resolveRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    port: resolvePort(env.PORT),
    corsOrigin: resolveCorsOrigin(env.CORS_ORIGIN),
  };
}
