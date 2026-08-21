import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { AuditEventsModule } from './modules/audit-events/audit-events.module';
import { AuthExceptionFilter } from './modules/auth/auth-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { UsersModule } from './modules/users/users.module';
import { UsageEventsModule } from './modules/usage-events/usage-events.module';

@Module({
  imports: [
    ObservabilityModule,
    AuditEventsModule,
    UsageEventsModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
})
export class AppModule {}
