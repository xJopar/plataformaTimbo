import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ObservabilityModule } from '../observability/observability.module';
import { PRODUCT_USAGE_EVENT_CATALOG, USAGE_EVENT_CATALOG } from './usage-event-catalog';
import { UsageEventsService } from './usage-events.service';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  providers: [
    UsageEventsService,
    {
      provide: USAGE_EVENT_CATALOG,
      useValue: PRODUCT_USAGE_EVENT_CATALOG,
    },
  ],
  exports: [UsageEventsService, USAGE_EVENT_CATALOG],
})
export class UsageEventsModule {}
