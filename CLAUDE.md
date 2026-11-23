# Altrastate School — CLAUDE.md

Reusable school website + CMS + admissions platform. **One codebase, deployed once per school** (own Vercel project, own Supabase project, own domain). Full spec: `docs/MASTER_PROMPT.md` (binding). Business requirements: `docs/PRD.pdf`.

## Stack
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (`@theme inline`, no tailwind.config) · shadcn/ui · Supabase (Postgres/Auth/Storage/RLS) via `@supabase/ssr` · Zod · React Hook Form · Tiptap v3 · Resend + React Email · Vitest · Playwright + axe · Vercel

## Commands
- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`
- `npm run test` (Vitest) · `npm run e2e` (Playwright) · `npm run test:db` (pgTAP via `supabase test db`)
- `npx supabase migration new <name>` · `npx supabase db reset` (local) · `npm run db:types` (regenerate `src/types/database.ts`)

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
