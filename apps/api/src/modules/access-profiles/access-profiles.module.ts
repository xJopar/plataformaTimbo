import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AccessProfilesService } from './access-profiles.service';
import { ApplicationAuthorizationService } from './application-authorization.service';
import {
  ACCESS_PROFILES_SERVICE,
  APPLICATION_AUTHORIZATION_SERVICE,
} from './access-profiles.tokens';

@Module({
  imports: [PrismaModule, AuditEventsModule],
  providers: [
    AccessProfilesService,
    ApplicationAuthorizationService,
    { provide: ACCESS_PROFILES_SERVICE, useExisting: AccessProfilesService },
    { provide: APPLICATION_AUTHORIZATION_SERVICE, useExisting: ApplicationAuthorizationService },
  ],
  exports: [
    AccessProfilesService,
    ApplicationAuthorizationService,
    ACCESS_PROFILES_SERVICE,
    APPLICATION_AUTHORIZATION_SERVICE,
  ],
})
export class AccessProfilesModule {}
