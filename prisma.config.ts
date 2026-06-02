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
    // Runtime queries — use pooled URL (pgBouncer) when available
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder',
    // Migrations — must use direct (non-pooled) URL; falls back to DATABASE_URL locally
    directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://placeholder',
  },
});
