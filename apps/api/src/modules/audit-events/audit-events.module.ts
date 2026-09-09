import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { AuditEventsService } from './audit-events.service';

@Module({
  imports: [ObservabilityModule],
  providers: [AuditEventsService],
  exports: [AuditEventsService],
})
export class AuditEventsModule {}
