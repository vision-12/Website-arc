# Altrastate School — CLAUDE.md

Reusable school website + CMS + admissions platform. **One codebase, deployed once per school** (own Vercel project, own Supabase project, own domain). Full spec: `docs/MASTER_PROMPT.md` (binding). Business requirements: `docs/PRD.pdf`.

## Stack

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (`@theme inline`, no tailwind.config) · shadcn/ui · Supabase (Postgres/Auth/Storage/RLS) via `@supabase/ssr` · Zod · React Hook Form · Tiptap v3 · Resend + React Email · Vitest · Playwright + axe · Vercel

## Commands

- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`
- `npm run test` (Vitest) · `npm run e2e` (Playwright) · `npm run test:db` (pgTAP via `supabase test db`)
- `npm run db:start` (local Supabase via GHCR) · `npm run db:reset` · `npx supabase migration new <name>` · `npm run db:types` (regenerate `src/types/database.ts`)
- `npm run test:int` (integration, needs the local stack) · `npm run check:actions` · `node scripts/check-advisors.mjs` · `node scripts/supabase-env.mjs` (env for the local stack)
- Local setup and seeded accounts: `docs/runbooks/local-dev.md`

## Hard rules (never break)

- Next 16: use `proxy.ts`, not `middleware.ts`. Await `params`/`searchParams`. Stay on the latest **patched** Next 16.x / React 19.2.x (React2Shell CVE-2025-55182).
- Supabase keys: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY`. No legacy anon/service_role keys.
- Protect with `supabase.auth.getClaims()`, never `getSession()`. Re-check permission **inside every Server Action** via `requirePermission()`.
- `lib/supabase/admin.ts` (secret key) is only for `app/api/cron/*`, `app/api/webhooks/*` and `scripts/`. Never in a request path.
- RLS on **every** table. In policies use `(select auth.uid())`, never a bare `auth.uid()`. Security-definer functions use `set search_path = ''`.
- Anon users get SELECT on published content only. Public writes go through `submit_enquiry` / `submit_application` RPCs, never direct inserts.
- Uploads: browser → Supabase Storage through `createSignedUploadUrl`. Never send file bytes through a Function (Vercel 4.5 MB limit).
- Admission documents live in a **private** bucket. Access is by 60-second signed URL after a permission check, and every download is audited.
- Never `'use cache'` anything user-specific or anything that sets cookies. Admin routes are dynamic. Public content is cached by tag and revalidated on publish.
- Tiptap: `immediatelyRender: false`. Store JSON. Render public pages with `@tiptap/static-renderer`. No base64 images. No `dangerouslySetInnerHTML` on user content.
- **No school-specific values in code** (names, phones, colours, copy). Everything comes from `site_settings` or env.
- Templates are presentation-only. They take typed props and never query the DB. Switching templates must not touch content.
- Never log personal data. Never disable RLS, even "temporarily".

## Mutation pattern (every Server Action)

`Zod parse → requirePermission → rate-limit (public) → DB write (user-scoped client) → audit log → updateTag/revalidateTag → return Result<{ok,data}|{ok:false,error}>`

## Conventions

- Feature folders: `src/features/<module>/{schema,queries,actions,permissions}.ts` + `components/` + `__tests__/`
- `import 'server-only'` in queries/actions. UK English in UI copy. Store UTC `timestamptz` and render in `site_settings.locale.timezone` (default Africa/Kampala).
- Plain-language admin copy ("Publish to website", "Hide from website"). Confirm destructive actions. Show save state.
- Conventional Commits. ADRs in `docs/adr/`. Phase plans in `docs/plan/`.

## Workflow

1. Plan mode first for anything bigger than one file. Write `docs/plan/phase-NN.md` and wait for approval.
2. Security-critical logic is test-first (RLS, permissions, admissions RPCs, upload validation).
3. Before claiming done: typecheck + lint + tests + build, plus Playwright screenshots at 360 px and 1280 px. Report against the phase Definition of Done (MASTER_PROMPT §12).
4. Supabase MCP: dev project only, with `read_only=true` and `project_ref` set. Never production.
5. Unsure about a business rule (admissions, retention, privacy)? Ask, then record the decision as an ADR.

## Gotchas (append as learned)

- Altrastate cyan `#00C2FF` fails contrast as text on white. Use it only for accents and focus rings.
- Supabase has no African region, so data is stored abroad and the DPPA s.19 notice is required on forms.
- CSP (ADR-000): `script-src` uses the per-request nonce **without** `'strict-dynamic'` (prerendered chunk scripts carry no nonce). Every route must keep a dynamic hole (the root layout's `RequestBoundary`), or Next serves un-nonced inline scripts. A fully static (○) page route is a bug.
- Never inline a `<style>` for theming. React drops nonces on hoisted styles. The theme is `/theme.css?v=<settings version>`. Runtime-injected styles get the nonce via `get-nonce` (`StyleNonce`). Avoid libraries that inject CSS at import time (e.g. sonner).
- Every E2E test fails on any browser CSP violation (`e2e/fixtures.ts`). Run E2E against `npm run build`, not `next dev`.
- `cacheComponents` forbids `new Date()` in prerendered code and the `dynamicParams` segment config. Use a `'use cache'` helper (`lib/dates/current-year.ts`) or static route folders.
- Portalled UI (Radix dialogs, sheets, menus) renders under `<body>`; admin tokens are scoped with `:root:has(.admin-scope)` so portals get them.
- Typed routes: `href`s must be real routes (`import type { Route } from 'next'`), not template strings.
- `next/font` options must be literal objects at each call site (no spreading of shared options).
- Pins: React 19.2.x (MP), TypeScript 5.9 (typescript-eslint `<6.1`), Playwright and `playwright-core` 1.63 (pre-installed browser). Renovate enforces them.
- User-scoped Supabase client awaits `connection()` (request-time only); the cached public client is PostgREST-only (`createPublicClient`). See ADR-000 amendment.
- Forms: submit buttons stay disabled until hydration (`useHydrated`). A pre-hydration Server Action submit on a PPR route returns only the streamed holes (blank page). Never render a form inside a streaming `<Suspense>`; read query params in the browser (`useSearchParam`). Public forms work the same way, plus a `<noscript>` notice built from `site_settings` (ADR-015).
- A form's `action` must be the Server Action itself. Validate in the browser in `onSubmit` (`useClientCheck`, same Zod schema); a client-function `action` makes React inline a form-replay script that has no nonce (CSP violation).
- The previous route stays mounted (hidden) after navigation: don't reuse element IDs across shells, and query by role in E2E (hidden content is ignored).
- RLS guards treat `auth.role() in (anon, authenticated)` as end users; migrations, seeds and the service role are "system". Our own definer RPCs that must write guarded columns set the transaction-local `app.trusted_rpc` flag around one statement.
- pgTAP: `supabase/tests/000_setup_helpers.sql` installs helpers (`tests.create_user`, `tests.authenticate_as`, …) and commits; every other file runs in a rolled-back transaction. Security tests are written first, then shown failing.
- Supabase Auth sees the app server's IP for every sign-in, so its per-IP limits are school-wide; keep them generous (ADR-008) — the app limiter is the real throttle.
- E2E: give each test its own `x-forwarded-for` (`uniqueIp`) so the per-IP login limit doesn't trip on the shared localhost IP.
- Templates (ADR-016): every `--tpl-*` token used as a utility must be mapped in `globals.css` `@theme inline` (`--color-tpl-…`); an unmapped class compiles to nothing. Shared template CSS lives in `@layer components` so utilities win.
- Templates never query the DB (ESLint): only `templates/shared/loaders` and `shared/sections.ts` may import Supabase clients or `*/queries`.
- Public islands stay tiny: no `cn`/tailwind-merge or lucide in them. Budget (ADR-017): the framework (~132 KB gzipped) plus at most 20 KB of our own JavaScript on public routes. `StyleNonce` (Radix overlays) is admin-only.
- next/font fallbacks use `local(Arial)`/`local(Times New Roman)`, absent on Android and Linux. `src/lib/fonts/fallbacks.css` covers them; rerun `node scripts/generate-font-fallbacks.mjs` after adding a family.
- Links named by their visible text: no `aria-label` that differs from it (WCAG 2.5.3). E2E axe runs after `settleEntrance()`, or contrast is measured mid-fade.
- Glass (`.tpl-glass`) only on floating controls; backdrop blur only on fine pointers. `/preview/template/*` is the only frameable route (`'self'`).
