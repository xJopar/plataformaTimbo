import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { resolveCorsOriginFromEnvironment } from '../../runtime-config';
import { AuthPublicError } from './auth-public.errors';

export const CSRF_HEADER_NAME = 'x-timbo-csrf';
export const CSRF_HEADER_VALUE = '1';

@Injectable()
export class CsrfProtectionGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.header('origin');
    const csrfHeader = request.header(CSRF_HEADER_NAME);

    if (origin !== resolveCorsOriginFromEnvironment() || csrfHeader !== CSRF_HEADER_VALUE) {
      throw new AuthPublicError('CSRF_REJECTED', 403);
    }

    return true;
  }
}
