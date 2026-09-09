import { createRequire } from 'node:module';

type PrismaGenerateRunner = (configPath: string) => boolean;

interface PrismaGenerateScript {
  generateClients(runPrismaGenerate: PrismaGenerateRunner): boolean;
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
});
