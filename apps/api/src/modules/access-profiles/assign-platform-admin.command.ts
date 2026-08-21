import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createStartupFailureDiagnostic } from '../../startup-failure-diagnostic';
import { AccessProfilesModule } from './access-profiles.module';
import { AccessProfilesService } from './access-profiles.service';

function readCorporateEmailArgument(argumentsList: string[]): string {
  if (argumentsList.length !== 2 || argumentsList[0] !== '--corporate-email') {
    throw new Error(
      'Uso: pnpm --filter @timbo/api assign-platform-admin -- --corporate-email <correo>.',
    );
  }
  const corporateEmail = argumentsList[1];
  if (corporateEmail === undefined || corporateEmail.trim().length === 0) {
    throw new Error('Debe indicarse un correo corporativo.');
  }
  return corporateEmail;
}

async function assignPlatformAdministrator(): Promise<void> {
  const corporateEmail = readCorporateEmailArgument(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AccessProfilesModule, { logger: false });

  try {
    const accessProfilesService = app.get(AccessProfilesService);
    await accessProfilesService.assignFirstPlatformAdministrator({ corporateEmail });
    console.log('Administrador de plataforma asignado.');
  } finally {
    await app.close();
  }
}

assignPlatformAdministrator().catch((error: unknown) => {
  console.error(JSON.stringify(createStartupFailureDiagnostic(error)));
  process.exitCode = 1;
});
