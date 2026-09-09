import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const applicationDirectory = resolve(__dirname, '..');
const runnerPath = resolve(applicationDirectory, 'scripts', 'run-preauthorize-user.cjs');

describe('comando preauthorize-user', () => {
  it('rechaza uso inválido antes de compilar o construir contexto de base de datos', () => {
    const result = spawnSync(process.execPath, [runnerPath, '--invalid'], {
      cwd: applicationDirectory,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Uso: pnpm --filter @timbo/api preauthorize-user');
    expect(result.stderr).not.toContain('DATABASE_URL');
  });

  it('rechaza un correo vacío antes de compilar o construir contexto de base de datos', () => {
    const result = spawnSync(process.execPath, [runnerPath, '--corporate-email', '   '], {
      cwd: applicationDirectory,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Debe indicarse un correo corporativo.');
    expect(result.stderr).not.toContain('DATABASE_URL');
  });

  it('acepta el delimitador de pnpm y reenvía el argumento corporate-email al validador', () => {
    const result = spawnSync(process.execPath, [runnerPath, '--', '--corporate-email', '   '], {
      cwd: applicationDirectory,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Debe indicarse un correo corporativo.');
    expect(result.stderr).not.toContain('DATABASE_URL');
  });
});
