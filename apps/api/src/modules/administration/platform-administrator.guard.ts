import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { AccessProfilesService } from '../access-profiles/access-profiles.service';
import { ACCESS_PROFILES_SERVICE } from '../access-profiles/access-profiles.tokens';
import { AuthPublicError } from '../auth/auth-public.errors';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';

@Injectable()
export class PlatformAdministratorGuard implements CanActivate {
  public constructor(
    @Inject(ACCESS_PROFILES_SERVICE) private readonly accessProfilesService: AccessProfilesService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authenticatedUser = request.authenticatedUser;
    if (authenticatedUser === undefined) {
      throw new Error('El guard de sesión debe ejecutarse antes del guard de administrador.');
    }

    const isPlatformAdministrator =
      await this.accessProfilesService.hasActivePlatformAdministratorAssignment(
        authenticatedUser.id,
      );
    if (!isPlatformAdministrator) {
      throw new AuthPublicError('AUTHORIZATION_REQUIRED', 403);
    }
    return true;
  }
}
