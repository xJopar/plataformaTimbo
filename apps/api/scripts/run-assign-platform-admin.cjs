const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const applicationDirectory = resolve(__dirname, '..');
const workspaceDirectory = resolve(applicationDirectory, '..', '..');
const pnpmCliPath = resolve(workspaceDirectory, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');

function validateArguments(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== '--corporate-email') {
    throw new Error(
      'Uso: pnpm --filter @timbo/api assign-platform-admin -- --corporate-email <correo>.',
    );
  }
  if (argumentsList[1].trim().length === 0) {
    throw new Error('Debe indicarse un correo corporativo.');
  }
}

function runCommand(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: applicationDirectory, stdio: 'inherit' });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }
  return true;
}

function run() {
  const rawCommandArguments = process.argv.slice(2);
  const commandArguments =
    rawCommandArguments[0] === '--' ? rawCommandArguments.slice(1) : rawCommandArguments;

  try {
    validateArguments(commandArguments);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (!runCommand(process.execPath, [pnpmCliPath, 'run', 'build'])) {
    return;
  }
  runCommand(process.execPath, [
    '--env-file=../../.env',
    'dist/modules/access-profiles/assign-platform-admin.command.js',
    ...commandArguments,
  ]);
}

run();
