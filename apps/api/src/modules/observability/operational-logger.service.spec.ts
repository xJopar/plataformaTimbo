import { OperationalLoggerService } from './operational-logger.service';

interface RequestCompletedLog {
  timestamp: string;
  level: string;
  service: string;
  environment: string;
  event: string;
  operation: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
}

interface RequestFailedLog {
  timestamp: string;
  level: string;
  service: string;
  environment: string;
  event: string;
  operation: string;
  requestId: string;
  method: string;
  route: string;
  name: string;
  message: string;
}

describe('OperationalLoggerService', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('emite la finalización de una petición exitosa a stdout con los campos base', () => {
    const logger = new OperationalLoggerService();

    logger.logRequestCompleted({
      requestId: 'request-a',
      method: 'GET',
      route: '/api/health',
      status: 200,
      durationMs: 12.5,
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const [serialized] = consoleLogSpy.mock.calls[0] as [string];
    const parsed = JSON.parse(serialized) as RequestCompletedLog;

    expect(parsed).toMatchObject({
      level: 'info',
      service: 'api',
      event: 'api.request.completed',
      operation: 'request',
      requestId: 'request-a',
      method: 'GET',
      route: '/api/health',
      status: 200,
      durationMs: 12.5,
    });
    expect(typeof parsed.timestamp).toBe('string');
    expect(typeof parsed.environment).toBe('string');
  });

  it('emite la finalización de un fallo inesperado a stderr, sin duplicar el diagnóstico', () => {
    const logger = new OperationalLoggerService();

    logger.logRequestCompleted({
      requestId: 'request-b',
      method: 'POST',
      route: '/api/auth/logout',
      status: 500,
      durationMs: 3,
    });

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [serialized] = consoleErrorSpy.mock.calls[0] as [string];
    const parsed = JSON.parse(serialized) as RequestCompletedLog;
    expect(parsed).toMatchObject({ level: 'error', status: 500, event: 'api.request.completed' });
  });

  it('emite el diagnóstico de fallo inesperado a stderr con nombre, mensaje y stack redactados', () => {
    const logger = new OperationalLoggerService();
    const error = new Error('fallo con token=secreto-en-mensaje');

    logger.logRequestFailed(error, {
      requestId: 'request-c',
      method: 'POST',
      route: '/api/auth/logout',
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [serialized] = consoleErrorSpy.mock.calls[0] as [string];
    expect(serialized).not.toContain('secreto-en-mensaje');
    const parsed = JSON.parse(serialized) as RequestFailedLog;

    expect(parsed).toMatchObject({
      level: 'error',
      service: 'api',
      event: 'api.request.failed',
      operation: 'request',
      requestId: 'request-c',
      method: 'POST',
      route: '/api/auth/logout',
      name: 'Error',
    });
    expect(parsed.message).toContain('[REDACTED]');
  });
});
