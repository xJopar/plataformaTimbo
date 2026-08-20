import {
  ArgumentsHost,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { OperationalLoggerService } from '../observability/operational-logger.service';
import { RequestContextService } from '../observability/request-context.service';
import { AuthExceptionFilter } from './auth-exception.filter';
import { AuthPublicError } from './auth-public.errors';

class ResponseMock {
  public statusCode: number | undefined;
  public body: unknown;

  public status(statusCode: number): this {
    this.statusCode = statusCode;
    return this;
  }

  public json(body: unknown): this {
    this.body = body;
    return this;
  }
}

function createHost(response: ResponseMock, request: Partial<Request> = {}): ArgumentsHost {
  const httpContext = {
    getResponse: () => response,
    getRequest: () => ({ method: 'GET', originalUrl: '/api/health', ...request }),
  };
  return {
    switchToHttp: () => httpContext,
  } as unknown as ArgumentsHost;
}

describe('AuthExceptionFilter', () => {
  let requestContext: RequestContextService;
  let operationalLogger: OperationalLoggerService;
  let logRequestFailedSpy: jest.SpiedFunction<OperationalLoggerService['logRequestFailed']>;
  let filter: AuthExceptionFilter;

  beforeEach(() => {
    requestContext = new RequestContextService();
    operationalLogger = new OperationalLoggerService();
    logRequestFailedSpy = jest
      .spyOn(operationalLogger, 'logRequestFailed')
      .mockImplementation(() => undefined);
    filter = new AuthExceptionFilter(requestContext, operationalLogger);
  });

  it('preserva status y código de un AuthPublicError, sin diagnóstico', () => {
    const response = new ResponseMock();

    filter.catch(new AuthPublicError('CSRF_REJECTED', 403), createHost(response));

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ code: 'CSRF_REJECTED' });
    expect(logRequestFailedSpy).not.toHaveBeenCalled();
  });

  it('preserva status y cuerpo de un HttpException 4xx esperado, sin diagnóstico', () => {
    const response = new ResponseMock();

    filter.catch(new NotFoundException('no encontrado'), createHost(response));

    expect(response.statusCode).toBe(404);
    expect(logRequestFailedSpy).not.toHaveBeenCalled();
  });

  it('preserva status y cuerpo de un ForbiddenException, sin diagnóstico', () => {
    const response = new ResponseMock();

    filter.catch(new ForbiddenException(), createHost(response));

    expect(response.statusCode).toBe(403);
    expect(logRequestFailedSpy).not.toHaveBeenCalled();
  });

  it('un HttpException >=500 preserva su status y cuerpo público seguro, y además loguea un diagnóstico correlacionado por requestId', () => {
    const response = new ResponseMock();
    const exception = new InternalServerErrorException('fallo interno controlado');

    requestContext.run({ requestId: 'request-http-500' }, () => {
      filter.catch(exception, createHost(response, { method: 'POST', originalUrl: '/api/health' }));
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual(exception.getResponse());
    expect(logRequestFailedSpy).toHaveBeenCalledTimes(1);
    expect(logRequestFailedSpy).toHaveBeenCalledWith(exception, {
      requestId: 'request-http-500',
      method: 'POST',
      route: '/api/health',
    });
  });

  it('un error inesperado (no HttpException) responde 500 genérico y loguea un único diagnóstico correlacionado', () => {
    const response = new ResponseMock();
    const exception = new Error('fallo de persistencia');

    requestContext.run({ requestId: 'request-unexpected' }, () => {
      filter.catch(exception, createHost(response));
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR' });
    expect(logRequestFailedSpy).toHaveBeenCalledTimes(1);
    expect(logRequestFailedSpy).toHaveBeenCalledWith(
      exception,
      expect.objectContaining({ requestId: 'request-unexpected' }),
    );
  });

  it('genera un requestId de respaldo si no hay contexto de petición activo, en vez de omitir el diagnóstico', () => {
    const response = new ResponseMock();

    filter.catch(new Error('fallo fuera de contexto'), createHost(response));

    expect(logRequestFailedSpy).toHaveBeenCalledTimes(1);
    expect(logRequestFailedSpy).toHaveBeenCalledWith(
      expect.any(Error),
      // expect.any(...) de Jest está tipado como "any" en @types/jest; no hay alternativa tipada.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });
});
