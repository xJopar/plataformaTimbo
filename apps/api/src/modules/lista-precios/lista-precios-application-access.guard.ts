import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { APPLICATION_AUTHORIZATION_SERVICE } from '../access-profiles/access-profiles.tokens';
import { AuthPublicError } from '../auth/auth-public.errors';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';

const LISTA_PRECIOS_APPLICATION_KEY = 'lista-precios';

@Injectable()
export class ListaPreciosApplicationAccessGuard implements CanActivate {
  public constructor(
    @Inject(APPLICATION_AUTHORIZATION_SERVICE)
    private readonly applicationAuthorizationService: ApplicationAuthorizationService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authenticatedUser = request.authenticatedUser;
    if (authenticatedUser === undefined) {
      throw new Error('El guard de sesión debe ejecutarse antes del guard de Lista de Precios.');
    }

    const hasApplicationAccess = await this.applicationAuthorizationService.hasApplicationAccess(
      authenticatedUser.id,
      LISTA_PRECIOS_APPLICATION_KEY,
    );
    if (!hasApplicationAccess) {
      throw new AuthPublicError('AUTHORIZATION_REQUIRED', 403);
    }

    return true;
  }
}
