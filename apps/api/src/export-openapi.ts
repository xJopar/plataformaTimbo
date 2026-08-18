import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { DEFAULT_CORS_ORIGIN } from './runtime-config';

async function exportOpenApiDocument(outputPath: string): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

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
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
