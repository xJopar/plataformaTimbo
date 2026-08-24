import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import {
  ACTIVITY_SERVICE,
  ADMINISTRATIVE_APPLICATIONS_SERVICE,
  ADMINISTRATIVE_APPLICATION_ACCESS_SERVICE,
  ADMINISTRATIVE_USERS_SERVICE,
} from './administration.tokens';
import { AdministrativeApplicationsController } from './administrative-applications.controller';
import { ApplicationsService } from './applications.service';
import { AdministrativeUsersController } from './administrative-users.controller';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { PlatformAdministratorGuard } from './platform-administrator.guard';
import { ApplicationAccessService } from './application-access.service';
import { AdministrativeApplicationAccessController } from './administrative-application-access.controller';

@Module({
  imports: [AuthModule, UsersModule, AccessProfilesModule, AuditEventsModule, PrismaModule],
  controllers: [
    AdministrativeUsersController,
    AdministrativeApplicationsController,
    ActivityController,
    AdministrativeApplicationAccessController,
  ],
  providers: [
    PlatformAdministratorGuard,
    ActivityService,
    ApplicationsService,
    ApplicationAccessService,
    { provide: ACTIVITY_SERVICE, useExisting: ActivityService },
    { provide: ADMINISTRATIVE_USERS_SERVICE, useExisting: UsersService },
    { provide: ADMINISTRATIVE_APPLICATIONS_SERVICE, useExisting: ApplicationsService },
    { provide: ADMINISTRATIVE_APPLICATION_ACCESS_SERVICE, useExisting: ApplicationAccessService },
  ],
})
export class AdministrationModule {}
