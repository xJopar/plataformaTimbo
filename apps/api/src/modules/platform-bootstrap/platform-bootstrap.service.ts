import { Inject, Injectable } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { ADMINISTRATIVE_APPLICATIONS_SERVICE } from '../administration/administration.tokens';
import type {
  ApplicationsService,
  AuthorizedApplication,
} from '../administration/applications.service';
import type { AuthenticatedIdentity } from '../auth/auth.service';

export interface PlatformBootstrap {
  session: AuthenticatedIdentity;
  applications: AuthorizedApplication[];
}

@Injectable()
export class PlatformBootstrapService {
  public constructor(
    private readonly authService: AuthService,
    @Inject(ADMINISTRATIVE_APPLICATIONS_SERVICE)
    private readonly applicationsService: ApplicationsService,
  ) {}

  public async bootstrap(user: User): Promise<PlatformBootstrap> {
    const [session, applications] = await Promise.all([
      this.authService.toAuthenticatedIdentity(user),
      this.applicationsService.listAuthorizedApplications(user.id),
    ]);

    return { session, applications };
  }
}
