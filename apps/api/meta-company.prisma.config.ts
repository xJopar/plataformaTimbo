import { defineConfig, env } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/meta-company/schema.prisma',
  migrations: { path: 'prisma/meta-company/migrations' },
  datasource: { url: env('DATABASE_META_EXAMPLE_URL') },
});
