import { Module } from '@nestjs/common';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../database/prisma.module';
import { MetaCompanyApplicationAccessGuard } from './meta-company-application-access.guard';
import { MetaCompanyController } from './meta-company.controller';
import {
  MetaCompanyCatalogManagementGuard,
  MetaCompanyGoalManagementGuard,
} from './meta-company-permission.guards';
import { MetaCompanyService } from './meta-company.service';
import { MetaCompanyPrismaModule } from './meta-company-prisma.module';

@Module({
  imports: [
    AuthModule,
    AccessProfilesModule,
    AuditEventsModule,
    PrismaModule,
    MetaCompanyPrismaModule,
  ],
  controllers: [MetaCompanyController],
  providers: [
    MetaCompanyApplicationAccessGuard,
    MetaCompanyCatalogManagementGuard,
    MetaCompanyGoalManagementGuard,
    MetaCompanyService,
  ],
})
export class MetaCompanyModule {}
