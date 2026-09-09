import { createRequire } from 'node:module';

type PrismaGenerateRunner = (configPath: string) => boolean;

interface PrismaGenerateScript {
  generateClients(environment: NodeJS.ProcessEnv, runPrismaGenerate: PrismaGenerateRunner): boolean;
}

const loadCommonJsModule = createRequire(__filename);
const prismaGenerateScript = loadCommonJsModule(
  '../scripts/run-prisma-generate.cjs',
) as PrismaGenerateScript;

describe('run-prisma-generate', () => {
  it('omite el cliente Meta Company cuando la aplicación está deshabilitada', () => {
    const runPrismaGenerate = jest.fn<
      ReturnType<PrismaGenerateRunner>,
      Parameters<PrismaGenerateRunner>
    >(() => true);

    expect(
      prismaGenerateScript.generateClients({ META_COMPANY_ENABLED: 'false' }, runPrismaGenerate),
    ).toBe(true);
    expect(runPrismaGenerate).toHaveBeenCalledTimes(1);
    expect(runPrismaGenerate).toHaveBeenCalledWith('prisma.config.ts');
  });

  it('genera ambos clientes cuando la aplicación está habilitada', () => {
    const runPrismaGenerate = jest.fn<
      ReturnType<PrismaGenerateRunner>,
      Parameters<PrismaGenerateRunner>
    >(() => true);

    expect(prismaGenerateScript.generateClients({}, runPrismaGenerate)).toBe(true);
    expect(runPrismaGenerate).toHaveBeenNthCalledWith(1, 'prisma.config.ts');
    expect(runPrismaGenerate).toHaveBeenNthCalledWith(2, 'meta-company.prisma.config.ts');
  });
});
