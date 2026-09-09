import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, AuditEventsModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
