import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { OperationalLoggerService } from './operational-logger.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { RESPONSE_REQUEST_ID_HEADER, isValidIncomingRequestId } from './request-id';

function createRequest(overrides: {
  headerValue?: string;
  method?: string;
  originalUrl?: string;
}): Request {
  return {
    header: () => overrides.headerValue,
    method: overrides.method ?? 'GET',
    originalUrl: overrides.originalUrl ?? '/api/health',
  } as unknown as Request;
}

class FakeResponse extends EventEmitter {
  public statusCode = 200;
  public readonly headers = new Map<string, string>();

  public setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
}

describe('RequestContextMiddleware', () => {
  it('preserva un X-Request-Id entrante válido, corre next() dentro del contexto y loguea exactamente una finalización', () => {
    const requestContext = new RequestContextService();
    const operationalLogger = new OperationalLoggerService();
    const logSpy = jest
      .spyOn(operationalLogger, 'logRequestCompleted')
      .mockImplementation(() => undefined);
    const middleware = new RequestContextMiddleware(requestContext, operationalLogger);

    const request = createRequest({ headerValue: 'cliente-valido-123' });
    const response = new FakeResponse() as unknown as Response & FakeResponse;
    let requestIdSeenByNext: string | undefined;

    middleware.use(request, response, () => {
      requestIdSeenByNext = requestContext.getRequestId();
    });

    expect(requestIdSeenByNext).toBe('cliente-valido-123');
    expect(response.headers.get(RESPONSE_REQUEST_ID_HEADER)).toBe('cliente-valido-123');

    response.statusCode = 200;
    response.emit('finish');
    response.emit('finish');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'cliente-valido-123',
        method: 'GET',
        route: '/api/health',
        status: 200,
      }),
    );
  });

  it('un close sin finish previo (aborto de cliente) también produce una finalización', () => {
    const requestContext = new RequestContextService();
    const operationalLogger = new OperationalLoggerService();
    const logSpy = jest
      .spyOn(operationalLogger, 'logRequestCompleted')
      .mockImplementation(() => undefined);
    const middleware = new RequestContextMiddleware(requestContext, operationalLogger);

    const request = createRequest({});
    const response = new FakeResponse() as unknown as Response & FakeResponse;

    middleware.use(request, response, () => undefined);
    response.statusCode = 499;
    response.emit('close');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 499 }));
  });

  it('un finish seguido de close produce sólo una finalización', () => {
    const requestContext = new RequestContextService();
    const operationalLogger = new OperationalLoggerService();
    const logSpy = jest
      .spyOn(operationalLogger, 'logRequestCompleted')
      .mockImplementation(() => undefined);
    const middleware = new RequestContextMiddleware(requestContext, operationalLogger);

    const request = createRequest({});
    const response = new FakeResponse() as unknown as Response & FakeResponse;

    middleware.use(request, response, () => undefined);
    response.statusCode = 200;
    response.emit('finish');
    response.emit('close');

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('reemplaza un X-Request-Id entrante inválido por uno generado', () => {
    const requestContext = new RequestContextService();
    const operationalLogger = new OperationalLoggerService();
    jest.spyOn(operationalLogger, 'logRequestCompleted').mockImplementation(() => undefined);
    const middleware = new RequestContextMiddleware(requestContext, operationalLogger);

    const request = createRequest({ headerValue: 'id inválido con espacios' });
    const response = new FakeResponse() as unknown as Response & FakeResponse;

    middleware.use(request, response, () => undefined);

    const assignedRequestId = response.headers.get(RESPONSE_REQUEST_ID_HEADER);
    expect(assignedRequestId).toBeDefined();
    expect(assignedRequestId).not.toBe('id inválido con espacios');
    expect(isValidIncomingRequestId(assignedRequestId)).toBe(true);
  });

  it('normaliza la ruta registrada sin exponer el query string', () => {
    const requestContext = new RequestContextService();
    const operationalLogger = new OperationalLoggerService();
    const logSpy = jest
      .spyOn(operationalLogger, 'logRequestCompleted')
      .mockImplementation(() => undefined);
    const middleware = new RequestContextMiddleware(requestContext, operationalLogger);

    const request = createRequest({
      method: 'GET',
      originalUrl: '/api/auth/google/callback?state=abc&code=super-secreto',
    });
    const response = new FakeResponse() as unknown as Response & FakeResponse;

    middleware.use(request, response, () => undefined);
    response.emit('finish');

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/auth/google/callback' }),
    );
  });
});
