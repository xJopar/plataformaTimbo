import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { UsersModule } from './users.module';
import { createStartupFailureDiagnostic } from '../../startup-failure-diagnostic';
import { CorporateEmailAlreadyInUseError, UserNotFoundError } from './users.errors';
import { UsersService } from './users.service';

function readCorporateEmailArgument(argumentsList: string[]): string {
  if (argumentsList.length !== 2 || argumentsList[0] !== '--corporate-email') {
    throw new Error(
      'Uso: pnpm --filter @timbo/api preauthorize-user -- --corporate-email <correo>.',
    );
  }

  const corporateEmail = argumentsList[1];
  if (corporateEmail === undefined || corporateEmail.trim().length === 0) {
    throw new Error('Debe indicarse un correo corporativo.');
  }

  return corporateEmail;
}

async function preauthorizeUser(): Promise<void> {
  const corporateEmail = readCorporateEmailArgument(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(UsersModule, { logger: false });

  try {
    const usersService = app.get(UsersService);
    try {
      await usersService.findByCorporateEmail({ corporateEmail });
      console.log('El usuario ya estaba preautorizado.');
    } catch (error) {
      if (!(error instanceof UserNotFoundError)) {
        throw error;
      }
      let userAlreadyExisted = false;
      try {
        await usersService.preauthorizeUser({ corporateEmail });
      } catch (creationError) {
        if (!(creationError instanceof CorporateEmailAlreadyInUseError)) {
          throw creationError;
        }
        await usersService.findByCorporateEmail({ corporateEmail });
        userAlreadyExisted = true;
      }
      console.log(
        userAlreadyExisted ? 'El usuario ya estaba preautorizado.' : 'Usuario preautorizado.',
      );
    }
  } finally {
    await app.close();
  }
}

preauthorizeUser().catch((error: unknown) => {
  console.error(JSON.stringify(createStartupFailureDiagnostic(error)));
  process.exitCode = 1;
});
