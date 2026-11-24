import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/** Integration tests: run against the local Supabase stack (`npm run db:start` + `npm run db:reset`). */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/empty-module.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    env: loadEnv('test', process.cwd(), ''),
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
