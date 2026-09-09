import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AuthModule } from '../auth/auth.module';
import { Seguimiento5sApplicationAccessGuard } from './seguimiento-5s-application-access.guard';
import {
  Seguimiento5sEntryManagementGuard,
  Seguimiento5sIndicatorManagementGuard,
  Seguimiento5sParticipantManagementGuard,
} from './seguimiento-5s-permission.guards';
import { Seguimiento5sController } from './seguimiento-5s.controller';
import { Seguimiento5sService } from './seguimiento-5s.service';

@Module({
  imports: [AuthModule, AccessProfilesModule, AuditEventsModule, PrismaModule],
  controllers: [Seguimiento5sController],
  providers: [
    Seguimiento5sApplicationAccessGuard,
    Seguimiento5sIndicatorManagementGuard,
    Seguimiento5sEntryManagementGuard,
    Seguimiento5sParticipantManagementGuard,
    Seguimiento5sService,
  ],
})
export class Seguimiento5sModule {}
