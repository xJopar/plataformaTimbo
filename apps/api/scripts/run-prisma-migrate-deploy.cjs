const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const applicationDirectory = resolve(__dirname, '..');
const prismaCliPath = resolve(applicationDirectory, 'node_modules', 'prisma', 'build', 'index.js');

function runMigrations(environment, runPrismaMigration) {
  return runPrismaMigration('prisma.config.ts');
}

function runPrismaMigration(configPath) {
  const result = spawnSync(
    process.execPath,
    [prismaCliPath, 'migrate', 'deploy', '--config', configPath],
    { cwd: applicationDirectory, stdio: 'inherit' },
  );

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
    runMigrations(process.env, runPrismaMigration);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations };
