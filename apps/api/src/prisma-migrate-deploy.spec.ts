import { createRequire } from 'node:module';

type MigrationRunner = (configPath: string) => boolean;

interface PrismaMigrateDeployScript {
  resolveMetaCompanyEnabled(environment: NodeJS.ProcessEnv): boolean;
  runMigrations(environment: NodeJS.ProcessEnv, runPrismaMigration: MigrationRunner): boolean;
}

const loadCommonJsModule = createRequire(__filename);
const prismaMigrateDeployScript = loadCommonJsModule(
  '../scripts/run-prisma-migrate-deploy.cjs',
) as PrismaMigrateDeployScript;

describe('run-prisma-migrate-deploy', () => {
  it('omite la migración secundaria cuando Meta Company está deshabilitada', () => {
    const runPrismaMigration = jest.fn<ReturnType<MigrationRunner>, Parameters<MigrationRunner>>(
      () => true,
    );

    expect(
      prismaMigrateDeployScript.runMigrations(
        { META_COMPANY_ENABLED: 'false' },
        runPrismaMigration,
      ),
    ).toBe(true);
    expect(runPrismaMigration).toHaveBeenCalledTimes(1);
    expect(runPrismaMigration).toHaveBeenCalledWith('prisma.config.ts');
  });

  it('ejecuta ambas migraciones cuando Meta Company está habilitada', () => {
    const runPrismaMigration = jest.fn<ReturnType<MigrationRunner>, Parameters<MigrationRunner>>(
      () => true,
    );

    expect(prismaMigrateDeployScript.runMigrations({}, runPrismaMigration)).toBe(true);
    expect(runPrismaMigration).toHaveBeenNthCalledWith(1, 'prisma.config.ts');
    expect(runPrismaMigration).toHaveBeenNthCalledWith(2, 'meta-company.prisma.config.ts');
  });

  it('rechaza valores inválidos de la bandera', () => {
    expect(() =>
      prismaMigrateDeployScript.resolveMetaCompanyEnabled({ META_COMPANY_ENABLED: '1' }),
    ).toThrow(/META_COMPANY_ENABLED/);
  });
});
