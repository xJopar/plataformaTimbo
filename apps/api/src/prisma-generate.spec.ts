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
  it('genera solamente el cliente de la base central', () => {
    const runPrismaGenerate = jest.fn<
      ReturnType<PrismaGenerateRunner>,
      Parameters<PrismaGenerateRunner>
    >(() => true);

    expect(prismaGenerateScript.generateClients(runPrismaGenerate)).toBe(true);
    expect(runPrismaGenerate).toHaveBeenCalledTimes(1);
    expect(runPrismaGenerate).toHaveBeenCalledWith('prisma.config.ts');
  });
});
