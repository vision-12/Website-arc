import { z } from 'zod';

/**
 * The one entry point for Zod in this codebase (enforced by ESLint).
 *
 * Why: when a schema is built, Zod 4 probes for a JIT by running `new Function("")`. Under our
 * strict CSP (no 'unsafe-eval', ADR-000) the browser reports that probe as a violation even though
 * Zod catches the error, and every E2E test fails on any CSP violation. Parsing without the JIT is
 * slightly slower and makes no difference at our sizes.
 */
z.config({ jitless: true });

export { z };
