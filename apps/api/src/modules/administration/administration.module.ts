import { Module } from '@nestjs/common';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { ADMINISTRATIVE_USERS_SERVICE } from './administration.tokens';
import { AdministrativeUsersController } from './administrative-users.controller';
import { PlatformAdministratorGuard } from './platform-administrator.guard';

@Module({
  imports: [AuthModule, UsersModule, AccessProfilesModule],
  controllers: [AdministrativeUsersController],
  providers: [
    PlatformAdministratorGuard,
    { provide: ADMINISTRATIVE_USERS_SERVICE, useExisting: UsersService },
  ],
})
export class AdministrationModule {}
