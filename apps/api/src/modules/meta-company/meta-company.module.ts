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
import { MetaCompanyServiceLayerService } from './meta-company-service-layer.service';
import { META_COMPANY_SERVICE_LAYER_FETCH } from './meta-company-service-layer.tokens';

@Module({
  imports: [AuthModule, AccessProfilesModule, AuditEventsModule, PrismaModule],
  controllers: [MetaCompanyController],
  providers: [
    MetaCompanyApplicationAccessGuard,
    MetaCompanyCatalogManagementGuard,
    MetaCompanyGoalManagementGuard,
    MetaCompanyServiceLayerService,
    MetaCompanyService,
    { provide: META_COMPANY_SERVICE_LAYER_FETCH, useValue: fetch },
  ],
})
export class MetaCompanyModule {}
