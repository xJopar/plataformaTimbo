import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { AuditEventsModule } from './modules/audit-events/audit-events.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { CalculadoraCuotasModule } from './modules/calculadora-cuotas/calculadora-cuotas.module';
import { AuthExceptionFilter } from './modules/auth/auth-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { HelloWorldModule } from './modules/hello-world/hello-world.module';
import { ListaPreciosModule } from './modules/lista-precios/lista-precios.module';
import { MetaCompanyModule } from './modules/meta-company/meta-company.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { Seguimiento5sModule } from './modules/seguimiento-5s/seguimiento-5s.module';
import { UsersModule } from './modules/users/users.module';
import { UsageEventsModule } from './modules/usage-events/usage-events.module';
import { PlatformBootstrapModule } from './modules/platform-bootstrap/platform-bootstrap.module';

@Module({})
export class AppModule {
  public static register(metaCompanyEnabled: boolean): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ObservabilityModule,
        AuditEventsModule,
        UsageEventsModule,
        AdministrationModule,
        HealthModule,
        UsersModule,
        AuthModule,
        PlatformBootstrapModule,
        HelloWorldModule,
        ListaPreciosModule,
        CalculadoraCuotasModule,
        ...(metaCompanyEnabled ? [MetaCompanyModule] : []),
        Seguimiento5sModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
    };
  }
}
