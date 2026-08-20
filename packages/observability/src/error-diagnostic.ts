import { redactDiagnosticText } from './secret-redaction';

export interface ErrorDiagnosticFields {
  name: string;
  code?: string;
  message: string;
  cause?: string;
  stack?: string;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : undefined;
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`;
  }
  if (typeof cause === 'string') {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

/**
 * Un handler terminal no puede asumir que dependencias externas redacten sus propios errores.
 * Conserva operación, clase, código, causa y stack disponibles, pero sanea cada texto antes
 * de enviarlo al log. Lo reutilizan API y gateway para no mantener dos contratos incompatibles
 * de secretos. `databaseUrl` es un parámetro explícito (no un default que lea `process.env`)
 * para que esta función permanezca pura: cada consumidor decide qué URL redactar, si alguna.
 * `additionalSensitiveValues` admite otros literales server-only conocidos por el llamador
 * (por ejemplo `API_INTERNAL_ORIGIN` en el gateway) sin convertir esta función en una
 * serialización de entorno: sigue sin leer `process.env`.
 */
export function buildErrorDiagnosticFields(
  error: unknown,
  databaseUrl: string | undefined,
  additionalSensitiveValues: readonly (string | undefined)[] = [],
): ErrorDiagnosticFields {
  const code = getErrorCode(error);

  if (!(error instanceof Error)) {
    return {
      name: 'NonErrorThrown',
      ...(code === undefined
        ? {}
        : { code: redactDiagnosticText(code, databaseUrl, additionalSensitiveValues) }),
      message: `Se lanzó un valor no Error de tipo ${typeof error}.`,
    };
  }

  return {
    name: redactDiagnosticText(error.name, databaseUrl, additionalSensitiveValues),
    ...(code === undefined
      ? {}
      : { code: redactDiagnosticText(code, databaseUrl, additionalSensitiveValues) }),
    message: redactDiagnosticText(error.message, databaseUrl, additionalSensitiveValues),
    ...(error.cause === undefined
      ? {}
      : {
          cause: redactDiagnosticText(
            describeCause(error.cause),
            databaseUrl,
            additionalSensitiveValues,
          ),
        }),
    ...(error.stack === undefined
      ? {}
      : { stack: redactDiagnosticText(error.stack, databaseUrl, additionalSensitiveValues) }),
  };
}
