import { createRequire } from 'node:module';

type MigrationRunner = (configPath: string) => boolean;
interface PrismaMigrateDeployScript {
  runMigrations(environment: NodeJS.ProcessEnv, runPrismaMigration: MigrationRunner): boolean;
}

const loadCommonJsModule = createRequire(__filename);
const prismaMigrateDeployScript = loadCommonJsModule(
  '../scripts/run-prisma-migrate-deploy.cjs',
) as PrismaMigrateDeployScript;

describe('run-prisma-migrate-deploy', () => {
  it('ejecuta solamente las migraciones de la base central', () => {
    const runPrismaMigration = jest.fn<ReturnType<MigrationRunner>, Parameters<MigrationRunner>>(
      () => true,
    );

    expect(prismaMigrateDeployScript.runMigrations({}, runPrismaMigration)).toBe(true);
    expect(runPrismaMigration).toHaveBeenCalledTimes(1);
    expect(runPrismaMigration).toHaveBeenCalledWith('prisma.config.ts');
  });
});
