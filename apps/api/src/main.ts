import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { resolveRuntimeConfig } from './runtime-config';
import { createStartupFailureDiagnostic } from './startup-failure-diagnostic';

async function bootstrap(): Promise<void> {
  const runtimeConfig = resolveRuntimeConfig();

  const app = await NestFactory.create(AppModule);
  configureApp(app, runtimeConfig.corsOrigin);

  await app.listen(runtimeConfig.port);
}

bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify(createStartupFailureDiagnostic(error)));
  process.exitCode = 1;
});
