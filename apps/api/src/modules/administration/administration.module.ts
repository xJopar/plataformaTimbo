import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { ACTIVITY_SERVICE, ADMINISTRATIVE_USERS_SERVICE } from './administration.tokens';
import { AdministrativeUsersController } from './administrative-users.controller';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { PlatformAdministratorGuard } from './platform-administrator.guard';

@Module({
  imports: [AuthModule, UsersModule, AccessProfilesModule, PrismaModule],
  controllers: [AdministrativeUsersController, ActivityController],
  providers: [
    PlatformAdministratorGuard,
    ActivityService,
    { provide: ACTIVITY_SERVICE, useExisting: ActivityService },
    { provide: ADMINISTRATIVE_USERS_SERVICE, useExisting: UsersService },
  ],
})
export class AdministrationModule {}
