import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { generateRequestId, normalizeRequestRoute } from '@timbo/observability';
import type { Request, Response } from 'express';
import { OperationalLoggerService } from '../observability/operational-logger.service';
import { RequestContextService } from '../observability/request-context.service';
import { AuthPublicError } from './auth-public.errors';

const UNEXPECTED_FAILURE_STATUS_THRESHOLD = 500;

@Catch()
@Injectable()
export class AuthExceptionFilter implements ExceptionFilter {
  public constructor(
    private readonly requestContext: RequestContextService,
    private readonly operationalLogger: OperationalLoggerService,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();

    if (exception instanceof AuthPublicError) {
      response.status(exception.statusCode).json({ code: exception.code });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= UNEXPECTED_FAILURE_STATUS_THRESHOLD) {
        // Un HttpException 5xx (por ejemplo InternalServerErrorException) sigue siendo un fallo
        // inesperado: conserva su status y cuerpo público seguro, pero también deja diagnóstico.
        this.logUnexpectedFailure(exception, request);
      }
      response.status(status).json(exception.getResponse());
      return;
    }

    // Filtro terminal: evita que Nest serialice errores de OAuth o Prisma sin redactar.
    this.logUnexpectedFailure(exception, request);
    response.status(500).json({ code: 'INTERNAL_ERROR' });
  }

  private logUnexpectedFailure(exception: unknown, request: Request): void {
    // La finalización de la petición (con su status) la emite RequestContextMiddleware por
    // separado, correlacionada por requestId: este diagnóstico nunca duplica ese evento.
    this.operationalLogger.logRequestFailed(exception, {
      requestId: this.requestContext.getRequestId() ?? generateRequestId(),
      method: request.method,
      route: normalizeRequestRoute(request.originalUrl),
    });
  }
}
