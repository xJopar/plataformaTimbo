import { Injectable } from '@nestjs/common';
import { buildErrorDiagnosticFields } from '@timbo/observability';
import { resolveEnvironmentFromEnvironment } from '../../runtime-config';

const SERVICE_NAME = 'api';
const UNEXPECTED_FAILURE_STATUS_THRESHOLD = 500;

export interface RequestCompletionFields {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
}

export interface RequestFailureFields {
  requestId: string;
  method: string;
  route: string;
}

type OperationalLogLevel = 'info' | 'error';

/**
 * Único punto de emisión de diagnóstico operativo estructurado a stdout/stderr. No conoce
 * HTTP más allá de los campos que recibe: los eventos de fallo inesperado usan el mismo
 * motor de redacción que el diagnóstico de arranque.
 */
@Injectable()
export class OperationalLoggerService {
  public logRequestCompleted(fields: RequestCompletionFields): void {
    const level: OperationalLogLevel =
      fields.status >= UNEXPECTED_FAILURE_STATUS_THRESHOLD ? 'error' : 'info';

    this.write(level, {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      environment: resolveEnvironmentFromEnvironment(),
      event: 'api.request.completed',
      operation: 'request',
      requestId: fields.requestId,
      method: fields.method,
      route: fields.route,
      status: fields.status,
      durationMs: fields.durationMs,
    });
  }

  public logRequestFailed(error: unknown, fields: RequestFailureFields): void {
    this.write('error', {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: SERVICE_NAME,
      environment: resolveEnvironmentFromEnvironment(),
      event: 'api.request.failed',
      operation: 'request',
      requestId: fields.requestId,
      method: fields.method,
      route: fields.route,
      ...buildErrorDiagnosticFields(error, process.env.DATABASE_URL),
    });
  }

  private write(level: OperationalLogLevel, payload: Record<string, unknown>): void {
    const serializedPayload = JSON.stringify(payload);

    if (level === 'error') {
      console.error(serializedPayload);
    } else {
      console.log(serializedPayload);
    }
  }
}
