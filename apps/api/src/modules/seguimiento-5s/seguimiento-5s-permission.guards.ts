import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { APPLICATION_AUTHORIZATION_SERVICE } from '../access-profiles/access-profiles.tokens';
import { AuthPublicError } from '../auth/auth-public.errors';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import { SEGUIMIENTO_5S_APPLICATION_KEY } from './seguimiento-5s-application-access.guard';

abstract class Seguimiento5sPermissionGuard implements CanActivate {
  protected abstract readonly permissionKey: string;

  public constructor(
    @Inject(APPLICATION_AUTHORIZATION_SERVICE)
    private readonly applicationAuthorizationService: ApplicationAuthorizationService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authenticatedUser;
    if (user === undefined) {
      throw new Error('El guard de sesión debe ejecutarse antes que Seguimiento 5S.');
    }
    if (
      !(await this.applicationAuthorizationService.hasApplicationPermission(
        user.id,
        SEGUIMIENTO_5S_APPLICATION_KEY,
        this.permissionKey,
      ))
    ) {
      throw new AuthPublicError('AUTHORIZATION_REQUIRED', 403);
    }
    return true;
  }
}

@Injectable()
export class Seguimiento5sIndicatorManagementGuard extends Seguimiento5sPermissionGuard {
  protected readonly permissionKey = 'manage-indicators';
}

@Injectable()
export class Seguimiento5sEntryManagementGuard extends Seguimiento5sPermissionGuard {
  protected readonly permissionKey = 'manage-entries';
}

@Injectable()
export class Seguimiento5sParticipantManagementGuard extends Seguimiento5sPermissionGuard {
  protected readonly permissionKey = 'manage-participants';
}
