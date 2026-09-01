import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './bootstrap';
import { HealthModule } from './health/health.module';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { CsrfProtectionGuard } from './modules/auth/csrf-protection.guard';
import { SessionAuthenticationGuard } from './modules/auth/session-authentication.guard';
import { AdministrativeUsersController } from './modules/administration/administrative-users.controller';
import { ActivityController } from './modules/administration/activity.controller';
import { AdministrativeApplicationsController } from './modules/administration/administrative-applications.controller';
import { AdministrativeApplicationAccessController } from './modules/administration/administrative-application-access.controller';
import { AuthorizedApplicationsController } from './modules/administration/authorized-applications.controller';
import { HelloWorldApplicationAccessGuard } from './modules/hello-world/hello-world-application-access.guard';
import { HelloWorldController } from './modules/hello-world/hello-world.controller';
import { HelloWorldService } from './modules/hello-world/hello-world.service';
import { ListaPreciosApplicationAccessGuard } from './modules/lista-precios/lista-precios-application-access.guard';
import { ListaPreciosController } from './modules/lista-precios/lista-precios.controller';
import { ListaPreciosService } from './modules/lista-precios/lista-precios.service';
import { MetaCompanyApplicationAccessGuard } from './modules/meta-company/meta-company-application-access.guard';
import { MetaCompanyController } from './modules/meta-company/meta-company.controller';
import {
  MetaCompanyCatalogManagementGuard,
  MetaCompanyGoalManagementGuard,
} from './modules/meta-company/meta-company-permission.guards';
import { MetaCompanyService } from './modules/meta-company/meta-company.service';
import { UsageEventsService } from './modules/usage-events/usage-events.service';
import { ACTIVITY_SERVICE } from './modules/administration/administration.tokens';
import { ADMINISTRATIVE_APPLICATIONS_SERVICE } from './modules/administration/administration.tokens';
import { ADMINISTRATIVE_USERS_SERVICE } from './modules/administration/administration.tokens';
import { ADMINISTRATIVE_APPLICATION_ACCESS_SERVICE } from './modules/administration/administration.tokens';
import { PlatformAdministratorGuard } from './modules/administration/platform-administrator.guard';
import { ACCESS_PROFILES_SERVICE } from './modules/access-profiles/access-profiles.tokens';
import { APPLICATION_AUTHORIZATION_SERVICE } from './modules/access-profiles/access-profiles.tokens';
import { USERS_SERVICE, USER_SESSIONS_SERVICE } from './modules/auth/auth.tokens';
import { DEFAULT_CORS_ORIGIN } from './runtime-config';
import { createStartupFailureDiagnostic } from './startup-failure-diagnostic';

@Module({
  imports: [HealthModule],
  controllers: [
    AuthController,
    AdministrativeUsersController,
    AdministrativeApplicationsController,
    AdministrativeApplicationAccessController,
    AuthorizedApplicationsController,
    ActivityController,
    HelloWorldController,
    ListaPreciosController,
    MetaCompanyController,
  ],
  providers: [
    { provide: AuthService, useValue: {} },
    { provide: SessionAuthenticationGuard, useValue: { canActivate: () => true } },
    { provide: PlatformAdministratorGuard, useValue: { canActivate: () => true } },
    { provide: CsrfProtectionGuard, useValue: { canActivate: () => true } },
    { provide: HelloWorldApplicationAccessGuard, useValue: { canActivate: () => true } },
    { provide: HelloWorldService, useValue: {} },
    { provide: ListaPreciosApplicationAccessGuard, useValue: { canActivate: () => true } },
    { provide: ListaPreciosService, useValue: {} },
    { provide: MetaCompanyApplicationAccessGuard, useValue: { canActivate: () => true } },
    { provide: MetaCompanyCatalogManagementGuard, useValue: { canActivate: () => true } },
    { provide: MetaCompanyGoalManagementGuard, useValue: { canActivate: () => true } },
    { provide: MetaCompanyService, useValue: {} },
    { provide: UsageEventsService, useValue: {} },
    { provide: ADMINISTRATIVE_USERS_SERVICE, useValue: {} },
    { provide: ADMINISTRATIVE_APPLICATIONS_SERVICE, useValue: {} },
    { provide: ADMINISTRATIVE_APPLICATION_ACCESS_SERVICE, useValue: {} },
    { provide: ACCESS_PROFILES_SERVICE, useValue: {} },
    { provide: APPLICATION_AUTHORIZATION_SERVICE, useValue: {} },
    { provide: USER_SESSIONS_SERVICE, useValue: {} },
    { provide: USERS_SERVICE, useValue: {} },
    { provide: ACTIVITY_SERVICE, useValue: {} },
  ],
})
class OpenApiExportModule {}

async function exportOpenApiDocument(outputPath: string): Promise<void> {
  const app = await NestFactory.create(OpenApiExportModule, { logger: false, abortOnError: false });

  try {
    // Se aplica la misma configuración que el runtime para conservar prefijo y documento publicados.
    const openApiDocument = configureApp(app, DEFAULT_CORS_ORIGIN);
    await writeFile(resolve(outputPath), `${JSON.stringify(openApiDocument, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

const outputArguments = process.argv.slice(2);
const outputPath = outputArguments[0];

if (
  outputArguments.length !== 1 ||
  outputPath === undefined ||
  outputPath === '--' ||
  basename(outputPath) === '--'
) {
  throw new Error('Debe indicarse la ruta de salida para el documento OpenAPI.');
}

exportOpenApiDocument(outputPath).catch((error: unknown) => {
  console.error(JSON.stringify(createStartupFailureDiagnostic(error)));
  process.exitCode = 1;
});
