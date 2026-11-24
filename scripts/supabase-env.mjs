#!/usr/bin/env node
/**
 * Prints the environment for running the app against the LOCAL Supabase stack, as KEY=value lines.
 * CI appends it to $GITHUB_ENV; locally: `node scripts/supabase-env.mjs >> .env.local` on a fresh copy.
 * The three app secrets are the public development values seeded into the local Vault
 * (supabase/seed.sql) — never used for a real installation.
 */
import { execFileSync } from 'node:child_process';

const raw = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const status = JSON.parse(raw.slice(raw.indexOf('{')));

const env = {
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
  MAILPIT_URL: status.MAILPIT_URL ?? status.INBUCKET_URL,
  SCHOOL_SLUG: 'local-dev',
  FORM_SIGNING_SECRET: 'local-form-signing-secret-0123456789abcdef', // gitleaks:allow (public dev value, matches seed.sql)
  IP_HASH_SALT: 'local-ip-hash-salt-0123456789abcdef', // gitleaks:allow (public dev value)
  CRON_SECRET: 'local-cron-secret-0123456789abcdef0123456789', // gitleaks:allow (public dev value)
};

for (const [k, v] of Object.entries(env)) {
  if (!v) throw new Error(`supabase status did not report a value for ${k}`);
  console.log(`${k}=${v}`);
}
