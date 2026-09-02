import {
  buildErrorDiagnosticFields,
  isValidIncomingRequestId,
  normalizeRequestRoute,
} from '@timbo/observability';

export type BrowserOperation =
  | 'applications.load-authorized'
  | 'administration.load-applications'
  | 'administration.manage-users'
  | 'hello-world.request-joke'
  | 'hello-world.translate-joke'
  | 'lista-precios.record-usage-event'
  | 'meta-company.load-data'
  | 'meta-company.update-goal'
  | 'meta-company.create-goal'
  | 'meta-company.create-catalog'
  | 'meta-company.save-advisor'
  | 'meta-company.update-advisor-status'
  | 'seguimiento-5s.load-data'
  | 'seguimiento-5s.save-entries'
  | 'seguimiento-5s.manage-indicators'
  | 'seguimiento-5s.manage-participants';

export interface BrowserOperationFailureContext {
  operation: BrowserOperation;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT';
  route: string;
  provider: 'api' | 'mymemory';
  status?: number;
  requestId?: string;
  sensitiveValues?: readonly string[];
}

export function reportBrowserOperationFailed(
  error: unknown,
  context: BrowserOperationFailureContext,
): void {
  const requestId =
    context.requestId !== undefined && isValidIncomingRequestId(context.requestId)
      ? context.requestId
      : undefined;

  console.error({
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'web',
    runtime: 'browser',
    event: 'web.browser.operation_failed',
    operation: context.operation,
    method: context.method,
    route: normalizeRequestRoute(context.route),
    provider: context.provider,
    ...(context.status === undefined ? {} : { status: context.status }),
    ...(requestId === undefined ? {} : { requestId }),
    ...buildErrorDiagnosticFields(error, undefined, context.sensitiveValues),
  });
}
