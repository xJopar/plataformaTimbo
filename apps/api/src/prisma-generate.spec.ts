import { createRequire } from 'node:module';

type PrismaGenerateRunner = (configPath: string) => boolean;

interface PrismaGenerateScript {
  PLACEHOLDER_META_COMPANY_DATABASE_URL: string;
  generateClients(runPrismaGenerate: PrismaGenerateRunner): boolean;
  resolvePrismaGenerateEnvironment(
    configPath: string,
    environment: NodeJS.ProcessEnv,
  ): NodeJS.ProcessEnv;
}

const loadCommonJsModule = createRequire(__filename);
const prismaGenerateScript = loadCommonJsModule(
  '../scripts/run-prisma-generate.cjs',
) as PrismaGenerateScript;

describe('run-prisma-generate', () => {
  it('genera ambos clientes aunque Meta Company esté deshabilitada en ejecución', () => {
    const runPrismaGenerate = jest.fn<
      ReturnType<PrismaGenerateRunner>,
      Parameters<PrismaGenerateRunner>
    >(() => true);

    expect(prismaGenerateScript.generateClients(runPrismaGenerate)).toBe(true);
    expect(runPrismaGenerate).toHaveBeenNthCalledWith(1, 'prisma.config.ts');
    expect(runPrismaGenerate).toHaveBeenNthCalledWith(2, 'meta-company.prisma.config.ts');
  });

  it('usa un datasource de compilación cuando Meta Company está deshabilitada', () => {
    expect(
      prismaGenerateScript.resolvePrismaGenerateEnvironment('meta-company.prisma.config.ts', {
        META_COMPANY_ENABLED: 'false',
      }),
    ).toEqual({
      DATABASE_META_EXAMPLE_URL: prismaGenerateScript.PLACEHOLDER_META_COMPANY_DATABASE_URL,
      META_COMPANY_ENABLED: 'false',
    });
  });
});
