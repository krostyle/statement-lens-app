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
    // Runtime queries — pooled URL (pgBouncer)
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder',
    // Migrations — Neon Vercel integration provides DATABASE_URL_UNPOOLED (direct, no pgBouncer)
    // Falls back to DIRECT_URL (manual), then DATABASE_URL (local dev, no pooler involved)
    directUrl:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      'postgresql://placeholder',
  },
});
