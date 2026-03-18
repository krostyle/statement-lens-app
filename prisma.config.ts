import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load .env locally if it exists (not available in Vercel/CI)
try {
  process.loadEnvFile(path.join(process.cwd(), '.env'));
} catch {
  // ignore — env vars are injected by the platform
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
});
