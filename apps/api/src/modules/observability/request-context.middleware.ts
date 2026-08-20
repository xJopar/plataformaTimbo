import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { OperationalLoggerService } from './operational-logger.service';
import { RequestContextService } from './request-context.service';
import {
  INCOMING_REQUEST_ID_HEADER,
  RESPONSE_REQUEST_ID_HEADER,
  resolveRequestId,
} from './request-id';
import { normalizeRequestRoute } from './request-route';

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/**
 * Corre antes que guards, pipes y controllers, por lo que toda respuesta —incluida un 401/403
 * de guard o un 500 del filtro de excepciones— ya trae `X-Request-Id` cuando se envía.
 * Emite exactamente una finalización estructurada por petición, sin importar cómo terminó.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  public constructor(
    private readonly requestContext: RequestContextService,
    private readonly operationalLogger: OperationalLoggerService,
  ) {}

  public use(request: Request, response: Response, next: NextFunction): void {
    const requestId = resolveRequestId(request.header(INCOMING_REQUEST_ID_HEADER));
    response.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);

    const method = request.method;
    const route = normalizeRequestRoute(request.originalUrl);
    const startedAt = process.hrtime.bigint();
    let hasLoggedCompletion = false;

    // `close` cubre un aborto de cliente que nunca dispara `finish` (y también puede dispararse
    // después de un `finish` normal); la guarda evita duplicar la finalización cuando ambos
    // eventos ocurren para la misma respuesta.
    const logCompletionOnce = (): void => {
      if (hasLoggedCompletion) {
        return;
      }
      hasLoggedCompletion = true;

      const durationMs = Number(process.hrtime.bigint() - startedAt) / NANOSECONDS_PER_MILLISECOND;
      this.operationalLogger.logRequestCompleted({
        requestId,
        method,
        route,
        status: response.statusCode,
        durationMs,
      });
    };

    response.once('finish', logCompletionOnce);
    response.once('close', logCompletionOnce);

    this.requestContext.run({ requestId }, () => {
      next();
    });
  }
}
