import {
  buildErrorDiagnosticFields,
  isValidIncomingRequestId,
  normalizeRequestRoute,
} from '@timbo/observability';

export type BrowserOperation = 'hello-world.request-joke' | 'hello-world.translate-joke';

export interface BrowserOperationFailureContext {
  operation: BrowserOperation;
  method: 'GET' | 'POST';
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
