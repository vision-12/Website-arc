# Local development

## Prerequisites

- Node 22 (`.nvmrc`), Docker running.
- `npm ci`

## Start the database (local Supabase)

```bash
npm run db:start      # Postgres 17, Auth, REST, Storage, Mailpit. Migrations + supabase/seed.sql applied
node scripts/supabase-env.mjs   # prints the env for .env.local (URL, keys, local secrets)
```

If Docker Hub or ECR refuse anonymous pulls, `db:start` already uses GHCR (`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`).

| Service                   | URL                                                     |
| ------------------------- | ------------------------------------------------------- |
| API                       | http://127.0.0.1:54321                                  |
| Postgres                  | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Mailpit (all auth emails) | http://127.0.0.1:54324                                  |

## Seeded accounts (local only)

All use the password `Local-dev-password-1`.

| Role                   | Email                   | Note                                                 |
| ---------------------- | ----------------------- | ---------------------------------------------------- |
| Super Administrator    | super.admin@demo.test   | requires two-step sign-in (MFA setup on first login) |
| School Administrator   | school.admin@demo.test  | sees all 15 sections                                 |
| Headteacher / Director | headteacher@demo.test   |                                                      |
| Admissions Officer     | admissions@demo.test    | requires two-step sign-in                            |
| Content Editor         | editor@demo.test        |                                                      |
| Events Manager         | events@demo.test        |                                                      |
| Read-only Staff        | readonly@demo.test      |                                                      |
| Altrastate Support     | support@altrastate.test | no personal data without a grant                     |

## Demo school and the template gallery (local only)

The seed (`supabase/seed/demo-content.sql`, `supabase/seed/demo-media.sql`) creates **Demo School**:

- settings with a full homepage, menus, footer and contact details
- four published pages
- 19 placeholder photographs in the local `media` bucket, made by `scripts/generate-demo-media.mjs`

Provisioning never runs these seeds.

| Page                                                             | Address                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Homepage in the saved template                                   | `/`                                                               |
| Template gallery: every section with demo data                   | `/preview/demo/<template>`                                        |
| Inner page in each layout                                        | `/preview/demo/<template>/page/<default \| wide \| with-sidebar>` |
| Real homepage in another template (signed in, `appearance.view`) | `/preview/template/<template>?t=<token>`                          |

`<template>` is one of `institutional-classic`, `modern-academic`, `heritage-prestige` or `contemporary-community`.

- **The gallery:** returns 404 on a school's production deployment.
- **Preview tokens:** come from the `createPreviewToken` action, which Phase 5's Appearance page calls. Until then the E2E suite signs them with `PREVIEW_TOKEN_SECRET` (`e2e/templates.spec.ts`).

## Everyday commands

| Task                                        | Command                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| Reset DB (re-run migrations + seed)         | `npm run db:reset`                                    |
| New migration                               | `npx supabase migration new <name>`                   |
| Regenerate DB types                         | `npm run db:types`                                    |
| RLS / security tests (pgTAP)                | `npm run test:db`                                     |
| DB lint / advisors                          | `npm run db:lint` · `node scripts/check-advisors.mjs` |
| Unit tests                                  | `npm run test`                                        |
| Integration tests (needs the stack)         | `npm run test:int`                                    |
| E2E (needs the stack and a build)           | `npm run build && npm run e2e`                        |
| Template-switch evidence                    | `WRITE_EVIDENCE=1 npm run test:int`                   |
| Font fallback faces (after adding a family) | `node scripts/generate-font-fallbacks.mjs`            |

## Phase 4: pages, media and scheduled jobs

| Task                                        | How                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Edit pages and upload photos                | Sign in as `editor@demo.test`, then **Website pages** or **Media library**                        |
| Run the scheduled-publishing job now        | `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3100/api/cron/publish`             |
| Run housekeeping (abandoned uploads, files) | `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3100/api/cron/housekeeping`        |
| Preview a draft                             | **Preview** in the page editor (a ten-minute link bound to you); **Exit preview** in the dark bar |

On Vercel, `vercel.json` runs both jobs as Vercel Schedules (publish every 5 minutes, housekeeping hourly); the routes check `CRON_SECRET` (plan P4-I).

**Addresses and statuses.** `proxy.ts` answers old addresses (renamed or moved pages) with a 308, from a copy of the `redirects` table it refreshes every 30 seconds. A page address the server hasn't rendered yet gets a soft "not found" (200 with `noindex`) on its very first visit and a real 404 after that: Next.js sends the prerendered shell before the page decides (Cache Components).

**E2E.** `e2e/cms.spec.ts` covers the Phase 4 journeys. `e2e/approval.spec.ts` switches the site-wide approval setting, so it runs in its own Playwright project after all the others. The editor's journey waits for the next whole minute to test scheduling, so it takes about two minutes.

## Changing auth settings

`supabase/config.toml` holds the local auth settings: sign-up disabled, 12-character passwords, TOTP, email templates and rate limits. After editing it, `npx supabase stop && npm run db:start`.
