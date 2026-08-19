import { ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { createStartupFailureDiagnostic } from '../../startup-failure-diagnostic';
import { AuthPublicError } from './auth-public.errors';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AuthPublicError) {
      response.status(exception.statusCode).json({ code: exception.code });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // El filtro terminal evita que Nest serialice errores de OAuth o Prisma sin redactar.
    console.error(
      JSON.stringify({
        ...createStartupFailureDiagnostic(exception),
        event: 'api.request.failed',
        operation: 'request',
      }),
    );
    response.status(500).json({ code: 'INTERNAL_ERROR' });
  }
}
