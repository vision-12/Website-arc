import { z } from 'zod';

/**
 * Environment contract (MASTER_PROMPT §9 + spec §7.4).
 * Variables marked "phase N" are optional until that phase wires them in; the
 * phase plan for N flips them to required.
 */

const httpsUrl = z
  .url()
  .refine((v) => v.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(v), {
    error: 'must be an https:// URL (http:// is allowed only for localhost)',
  });

const secret = (min = 32) => z.string().min(min, `must be at least ${min} characters`);

export const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_SITE_URL: httpsUrl,
    NEXT_PUBLIC_SUPABASE_URL: httpsUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .startsWith('sb_publishable_', 'must be a Supabase publishable key (sb_publishable_…)'),
    NEXT_PUBLIC_MAP_PROVIDER: z.enum(['google', 'maptiler', 'osm']).default('osm'),
    NEXT_PUBLIC_MAP_PUBLIC_KEY: z.string().optional(), // phase 11
  })
  .superRefine((env, ctx) => {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string' && /^sb_secret_/.test(value)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'a secret key must never be exposed through a NEXT_PUBLIC_ variable',
        });
      }
    }
  });

export const serverEnvSchema = z.object({
  SCHOOL_SLUG: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}$/, 'lowercase letters, digits and dashes'),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_').optional(), // phase 2
  RESEND_API_KEY: z.string().startsWith('re_').optional(), // phase 11/14
  EMAIL_FROM: z.string().optional(), // phase 11
  EMAIL_ADMISSIONS_INBOX: z.email().optional(), // phase 12
  RESEND_WEBHOOK_SECRET: z.string().optional(), // phase 14
  CRON_SECRET: secret().optional(), // phase 4
  PREVIEW_TOKEN_SECRET: secret().optional(), // phase 4
  FORM_SIGNING_SECRET: secret().optional(), // phase 2 (spec D5)
  IP_HASH_SALT: secret().optional(), // phase 2 (spec D10)
  SENTRY_DSN: z.url().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvError';
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

/** Treat empty strings as unset so `.env` placeholders don't satisfy validation. */
function clean(source: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '',
    ),
  );
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(clean(source));
  if (!result.success) throw new EnvError(formatIssues(result.error));
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(clean(source));
  if (!result.success) throw new EnvError(formatIssues(result.error));
  return result.data;
}

/** Used by next.config.ts so `next build` fails fast with a readable list. */
export function assertEnv(source: Record<string, string | undefined>): void {
  const issues: string[] = [];
  for (const parse of [parsePublicEnv, parseServerEnv]) {
    try {
      parse(source);
    } catch (e) {
      if (e instanceof EnvError) issues.push(...e.issues);
      else throw e;
    }
  }
  if (issues.length) throw new EnvError(issues);
}
