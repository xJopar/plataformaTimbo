const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { resolveMetaCompanyEnabled } = require('./meta-company-feature.cjs');

const applicationDirectory = resolve(__dirname, '..');
const prismaCliPath = resolve(applicationDirectory, 'node_modules', 'prisma', 'build', 'index.js');

function generateClients(environment, runPrismaGenerate) {
  if (!runPrismaGenerate('prisma.config.ts')) {
    return false;
  }

  return (
    !resolveMetaCompanyEnabled(environment) || runPrismaGenerate('meta-company.prisma.config.ts')
  );
}

function runPrismaGenerate(configPath) {
  const result = spawnSync(process.execPath, [prismaCliPath, 'generate', '--config', configPath], {
    cwd: applicationDirectory,
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
    generateClients(process.env, runPrismaGenerate);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateClients };
