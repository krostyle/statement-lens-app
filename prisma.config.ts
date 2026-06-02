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

// If DIRECT_URL not set (local dev), fall back to DATABASE_URL — local DB is always a direct connection
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
});
