import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const pnpmCliPath = join(workspaceRoot, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');

function runCommand(command, argumentsList) {
  return new Promise((resolvePromise, rejectPromise) => {
    const childProcess = spawn(command, argumentsList, {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });

    childProcess.once('error', rejectPromise);
    childProcess.once('exit', (exitCode) => {
      if (exitCode === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`El comando ${command} terminó con código ${String(exitCode)}.`));
    });
  });
}

async function assertContractsAreCurrent() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'timbo-contracts-'));
  const temporaryDocumentPath = join(temporaryDirectory, 'openapi.json');
  const temporaryTypesPath = join(temporaryDirectory, 'openapi.ts');

  try {
    await runCommand(process.execPath, [
      pnpmCliPath,
      '--filter',
      '@timbo/api',
      'export:openapi',
      temporaryDocumentPath,
    ]);
    await runCommand(process.execPath, [
      pnpmCliPath,
      '--filter',
      '@timbo/contracts',
      'exec',
      'openapi-typescript',
      temporaryDocumentPath,
      '-o',
      temporaryTypesPath,
    ]);

    const [generatedDocument, versionedDocument, generatedTypes, versionedTypes] =
      await Promise.all([
        readFile(temporaryDocumentPath),
        readFile(join(workspaceRoot, 'packages/contracts/openapi.json')),
        readFile(temporaryTypesPath),
        readFile(join(workspaceRoot, 'packages/contracts/src/generated/openapi.ts')),
      ]);

    if (!generatedDocument.equals(versionedDocument) || !generatedTypes.equals(versionedTypes)) {
      throw new Error(
        'Los contratos OpenAPI versionados están desactualizados. Ejecutá "pnpm generate:contracts" y versioná los cambios resultantes.',
      );
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

assertContractsAreCurrent().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
