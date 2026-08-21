import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AccessProfilesService } from './access-profiles.service';
import { ACCESS_PROFILES_SERVICE } from './access-profiles.tokens';

@Module({
  imports: [PrismaModule, AuditEventsModule],
  providers: [
    AccessProfilesService,
    { provide: ACCESS_PROFILES_SERVICE, useExisting: AccessProfilesService },
  ],
  exports: [AccessProfilesService, ACCESS_PROFILES_SERVICE],
})
export class AccessProfilesModule {}
