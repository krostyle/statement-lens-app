import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load .env.local then .env locally (not available in Vercel/CI)
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
    break;
  } catch {
    // ignore — file may not exist
  }
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder',
  },
});
