import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Node 22 built-in: load .env before Prisma evaluates the config
process.loadEnvFile(path.join(process.cwd(), '.env'));

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
