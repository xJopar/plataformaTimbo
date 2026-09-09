const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { resolveMetaCompanyEnabled } = require('./meta-company-feature.cjs');

const applicationDirectory = resolve(__dirname, '..');
const prismaCliPath = resolve(applicationDirectory, 'node_modules', 'prisma', 'build', 'index.js');
const META_COMPANY_PRISMA_CONFIG = 'meta-company.prisma.config.ts';
const PLACEHOLDER_META_COMPANY_DATABASE_URL =
  'postgresql://placeholder:placeholder@localhost:5432/meta_company?schema=public';

function generateClients(runPrismaGenerate) {
  if (!runPrismaGenerate('prisma.config.ts')) {
    return false;
  }

  return runPrismaGenerate(META_COMPANY_PRISMA_CONFIG);
}

function resolvePrismaGenerateEnvironment(configPath, environment) {
  const metaCompanyDatabaseUrl = environment.DATABASE_META_EXAMPLE_URL?.trim();

  if (
    configPath !== META_COMPANY_PRISMA_CONFIG ||
    resolveMetaCompanyEnabled(environment) ||
    (metaCompanyDatabaseUrl !== undefined && metaCompanyDatabaseUrl !== '')
  ) {
    return environment;
  }

  // Prisma resuelve el datasource al generar tipos, aunque no llegue a conectarse.
  return { ...environment, DATABASE_META_EXAMPLE_URL: PLACEHOLDER_META_COMPANY_DATABASE_URL };
}

function runPrismaGenerate(configPath) {
  const result = spawnSync(process.execPath, [prismaCliPath, 'generate', '--config', configPath], {
    cwd: applicationDirectory,
    env: resolvePrismaGenerateEnvironment(configPath, process.env),
    stdio: 'inherit',
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }

  return true;
}

function main() {
  try {
    generateClients(runPrismaGenerate);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  PLACEHOLDER_META_COMPANY_DATABASE_URL,
  generateClients,
  resolvePrismaGenerateEnvironment,
};
