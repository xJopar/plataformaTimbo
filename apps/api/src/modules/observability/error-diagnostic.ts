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
 * de enviarlo al log. Lo reutilizan el diagnóstico de arranque y el diagnóstico de peticiones
 * para no mantener dos contratos incompatibles de secretos.
 */
export function buildErrorDiagnosticFields(
  error: unknown,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): ErrorDiagnosticFields {
  const code = getErrorCode(error);

  if (!(error instanceof Error)) {
    return {
      name: 'NonErrorThrown',
      ...(code === undefined ? {} : { code: redactDiagnosticText(code, databaseUrl) }),
      message: `Se lanzó un valor no Error de tipo ${typeof error}.`,
    };
  }

  return {
    name: redactDiagnosticText(error.name, databaseUrl),
    ...(code === undefined ? {} : { code: redactDiagnosticText(code, databaseUrl) }),
    message: redactDiagnosticText(error.message, databaseUrl),
    ...(error.cause === undefined
      ? {}
      : { cause: redactDiagnosticText(describeCause(error.cause), databaseUrl) }),
    ...(error.stack === undefined ? {} : { stack: redactDiagnosticText(error.stack, databaseUrl) }),
  };
}
