import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { resolveRuntimeConfig } from './runtime-config';

async function bootstrap(): Promise<void> {
  const runtimeConfig = resolveRuntimeConfig();

  const app = await NestFactory.create(AppModule);
  configureApp(app, runtimeConfig.corsOrigin);

  await app.listen(runtimeConfig.port);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
