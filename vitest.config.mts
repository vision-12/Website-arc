import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside the react-server condition; unit tests import server modules directly.
      'server-only': fileURLToPath(new URL('./test/empty-module.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**',
        'src/features/**/theme/**',
        'src/features/admin-shell/sections.ts',
        'scripts/*.mjs',
      ],
      // Excluded: thin wiring covered by the build/E2E (next/font, env accessors, 'use cache' helpers) and the
      // audit CLI, which shells out to npm and runs as its own CI step.
      exclude: [
        'src/lib/fonts/fonts.ts',
        'src/lib/env/public.ts',
        'src/lib/dates/current-year.ts',
        'scripts/check-audit.mjs',
        '**/__tests__/**',
      ],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
