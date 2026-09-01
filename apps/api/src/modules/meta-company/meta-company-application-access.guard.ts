import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { APPLICATION_AUTHORIZATION_SERVICE } from '../access-profiles/access-profiles.tokens';
import { AuthPublicError } from '../auth/auth-public.errors';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';

export const META_COMPANY_APPLICATION_KEY = 'meta-company';

@Injectable()
export class MetaCompanyApplicationAccessGuard implements CanActivate {
  public constructor(
    @Inject(APPLICATION_AUTHORIZATION_SERVICE)
    private readonly applicationAuthorizationService: ApplicationAuthorizationService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authenticatedUser;
    if (user === undefined)
      throw new Error('El guard de sesión debe ejecutarse antes que Meta Company.');
    if (
      !(await this.applicationAuthorizationService.hasApplicationAccess(
        user.id,
        META_COMPANY_APPLICATION_KEY,
      ))
    ) {
      throw new AuthPublicError('AUTHORIZATION_REQUIRED', 403);
    }
    return true;
  }
}
