import { buildErrorDiagnosticFields } from '@timbo/observability';
import { resolveEnvironmentFromEnvironment } from './runtime-config';

const SERVICE_NAME = 'api';

export interface StartupFailureDiagnostic {
  timestamp: string;
  level: 'error';
  service: 'api';
  environment: string;
  event: 'api.bootstrap.failed';
  operation: 'bootstrap';
  name: string;
  code?: string;
  message: string;
  cause?: string;
  stack?: string;
}

/**
 * El handler terminal de `bootstrap()` no puede asumir que dependencias externas (Prisma,
 * Google) redacten sus propios errores. Reutiliza el mismo motor de redacción que el
 * diagnóstico de peticiones para no mantener dos contratos incompatibles de secretos, y expone
 * los mismos campos base (timestamp/level/service/environment) que `api.request.completed` y
 * `api.request.failed`, documentados en docs/OBSERVABILITY_LOGGING.md.
 */
export function createStartupFailureDiagnostic(
  error: unknown,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): StartupFailureDiagnostic {
  return {
    timestamp: new Date().toISOString(),
    level: 'error',
    service: SERVICE_NAME,
    environment: resolveEnvironmentFromEnvironment(),
    event: 'api.bootstrap.failed',
    operation: 'bootstrap',
    ...buildErrorDiagnosticFields(error, databaseUrl),
  };
}
