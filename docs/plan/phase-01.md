# Phase 1 — Foundation & design system (plan)

**Status:** awaiting approval. Nothing in this file has been built yet.
**Inputs:**
- MASTER_PROMPT §2, §4, §10, §11 and §12 (Phase 1 prompt)
- Spec §0, §5.0, §6.2 and §8.1
- Spec decisions D7 and D10

## 1. Goal

A running Next.js 16 app with no database. It ships:
- the full toolchain and CI gates
- strict security headers and CSP
- validated environment variables
- the theme-token layer (`site_settings.theme` → CSS variables, with contrast validation)
- the admin shell in Altrastate branding

Everything later phases build on is in place and tested. Nothing school-specific exists yet.

## 2. Pinned versions (checked against npm on 23 Nov 2026)

| Package | Pin | Note |
|---|---|---|
| node | ≥ 20.9; CI uses 22.x | `.nvmrc` = 22; `engines` field |
| next / eslint-config-next | **16.4.6** | latest 16.x |
| react / react-dom | **19.2.9** | MP §2 says "latest patched 19.2.x". **19.3.1 exists** — staying on 19.2.x until you say otherwise (**decision P1-B**) |
| typescript | **5.9.3** | TS 7.0 is out but typescript-eslint supports `<6.1` |
| tailwindcss / @tailwindcss/postcss | 4.3.x | `@theme inline`, no config file |
| tw-animate-css | 1.4.x | |
| shadcn (CLI) | 4.23.x | initialised for Tailwind v4 with CSS variables |
| zod | 4.x | |
| vitest | 5.x | + @vitejs/plugin-react, jsdom, @testing-library/react |
| @playwright/test | **1.63.x** | matches the browser pre-installed in this environment; CI installs its own browsers |
| @axe-core/playwright | 4.14.x | |
| eslint / prettier | 10.x / 3.x | flat config; `prettier-plugin-tailwindcss` |
| husky / lint-staged | 9.x / 17.x | |

Exact versions are frozen in `package-lock.json`. Renovate is configured to group React/Next security updates and open PRs weekly.

## 3. Work items

### 3.1 Scaffold
- `create-next-app`: TypeScript, App Router, `src/`, Turbopack, ESLint, no Tailwind preset. Tailwind v4 is added by hand so the CSS layout matches MP §2.7.
- `next.config.ts`:
  - `cacheComponents: true`
  - `typedRoutes: true`
  - `serverActions.allowedOrigins` from `NEXT_PUBLIC_SITE_URL`
  - `images.remotePatterns` limited to the Supabase storage host
  - `poweredByHeader: false`
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`; path alias `@/*`.
- The folder skeleton from MP §4.1 is created with empty `index` barrels only where a later phase needs them. There are no placeholder features.

### 3.2 Environment (`src/lib/env.ts`)
- Two Zod-validated exports:
  - `serverEnv` — imports `server-only`; covers all MP §9 vars plus `FORM_SIGNING_SECRET` and `IP_HASH_SALT` (spec §7.4)
  - `publicEnv` — `NEXT_PUBLIC_*` only
- The build fails with a readable list of missing or invalid variables.
- Phase-gated variables are optional until their phase, with a TODO linked to an issue: Resend, maps, Sentry, preview, cron.
- `SUPABASE_SECRET_KEY` is readable only from `lib/supabase/admin.ts`. That file is created in Phase 2; the ESLint guard is added now.
- `.env.example` is committed, with comments; `.env*.local` is gitignored.

### 3.3 Security headers & CSP
- `src/proxy.ts`:
  - generates a per-request nonce
  - sets `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'`; `style-src 'self' 'nonce-…'`; `img-src 'self' data: blob: <supabase-storage-host> <map/video thumbnail hosts>`; `connect-src 'self' <supabase-host>`; `frame-ancestors 'none'`; `form-action 'self'`; `base-uri 'none'`; `object-src 'none'`; `upgrade-insecure-requests`
  - the CSP builder lives in `lib/security/csp.ts`, is pure and is unit-tested
- Static headers go in `next.config.ts`:
  - HSTS: 2 years, `includeSubDomains`, no `preload` yet
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
  - `Cross-Origin-Opener-Policy: same-origin`
- `/admin/*` responses get `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.

> **Decision P1-A — CSP nonces vs cached static shells (needs your call).** A nonce must be unique per request. In Next.js, any page that reads the nonce is therefore **rendered per request**: there is no prerendered static HTML shell. MP asks for both a nonce-based CSP (§7.5) and static shells with cached data (§10).
>
> - **Option 1 (recommended): nonce CSP everywhere.**
>   - Data stays cached with `'use cache'` and tags, so publishing still updates within seconds.
>   - Each HTML render costs roughly 30–80 ms of server time against cached data, with no extra DB hit.
>   - It is the simplest and strongest option, and matches MP §7.5 literally.
>   - Spec §5.0's phrase "static shell" becomes "per-request render over cached data".
>   - Phase 14's Lighthouse gate (LCP ≤ 2.5 s on Slow 4G) checks whether this is good enough.
> - **Option 2: hash-based CSP on public routes.**
>   - Next's experimental SRI, with `'strict-dynamic'` and sha256 hashes, keeps real static shells and CDN-cached HTML.
>   - The nonce stays for admin and auth routes.
>   - It is faster on the first byte, but the SRI support is still **experimental** and the CSP becomes route-dependent.
>
> **Recommendation:** Option 1 now, with Option 2 evaluated in Phase 14 if the LCP budget is missed. That fallback would be recorded in ADR-000.

### 3.4 Styling & design system
- `src/app/globals.css`:
  - `@import "tailwindcss"`; `@import "tw-animate-css"`
  - `@theme inline` maps semantic tokens to CSS variables
  - `:root` / `.dark` sit at the root, not inside `@layer`
- Two token namespaces:
  - **Admin (Altrastate)**: `--admin-bg #F5F7FA`, `--admin-ink #0B1F3A`, `--admin-accent #00C2FF`. The accent is used **only** for focus rings, indicators and borders, never as text on light backgrounds; a unit test asserts this. These are product brand values, not school values, so they are allowed. They live in `src/app/admin/admin-tokens.css`, which is allow-listed in the school-values check.
  - **Public (school)**: `--brand-*` variables injected at runtime (§3.5). There are no hex values in source.
- shadcn/ui initialised (new-york style, CSS variables, `lucide-react` icons). Initial components: button, input, label, dialog, dropdown-menu, sheet, tooltip, separator, skeleton, sonner (toasts with `aria-live`), badge, card, scroll-area.
- `src/lib/fonts.ts`: the 8 allow-listed `next/font/google` families from MP §3.3, with `preload: false`, `display: 'swap'` and ≤ 2 weights each (4 per pair). `FontKey` is derived from this map.
- Global a11y base styles: `:focus-visible` ring (≥ 3:1), min target 24 px, `prefers-reduced-motion` reset, skip-link component.
- i18n seam (Q6): `src/lib/i18n/t.ts` with a typed `en-GB` message catalogue. Admin shell strings go through it from the start.

### 3.5 Theme-token layer (spec §6.2)
- `src/features/cms/settings/schema.ts`: the `SiteSettings` Zod schema from MP §3.2 plus the spec §1.3 extensions. Only the `theme`, `identity` and `locale` parts are needed now, but the full schema is written once so it doesn't drift.
- `src/lib/colour/`:
  - `contrast.ts`: WCAG 2.x relative luminance and ratio
  - `oklch.ts`: hex ↔ OKLCH conversion, tint/shade scale 50–900
  - `suggest.ts`: darken in OKLCH until 4.5:1, returning the suggested hex
- `src/features/templates/theme/build-theme-vars.ts` (pure): `Theme` → `Record<'--brand-…', string>`, including the `-fg` pairings, scales, radius, density and font variables.
- `src/features/templates/theme/ThemeStyle.tsx`: a server component that emits a **nonced** `<style>:root{…}</style>` (spec §6.2).
- `getSiteSettings()` in Phase 1 is a stub that returns a **neutral greyscale fallback theme** (`src/features/cms/settings/fallback.ts`). It is non-school-specific and allow-listed in the check. Phase 2 replaces the stub with the DB read; the signature stays the same.
- `validateThemeContrast(theme)` returns `{ ok } | { ok: false, issues: [{ token, ratio, against, suggestion }] }` with plain-language messages. Phase 5 wires it into the appearance screen.

### 3.6 Admin shell (Altrastate branding, no auth yet)
- `src/app/admin/layout.tsx`:
  - a sidebar with the 15 PRD §6.2 sections, in order, with icons and plain labels
  - the permission filter is a typed hook point (`visibleSections(perms)`) that receives "all" in Phase 1 and real permissions in Phase 2
  - the top bar has the school-name slot, "View website" and a user-menu placeholder
  - breadcrumbs, a toast region and an offline banner (`navigator.onLine`)
  - below 1024 px the sidebar becomes a `Sheet` drawer
- `/admin/overview` shows an empty-state card ("Your dashboard will show applications, enquiries and upcoming events here."). Other sections render a shared "Not available yet" empty state. Nothing is a fake feature.
- Shared components:
  - `EmptyState`, `SaveStateIndicator` (the 3 states from MP §11, as a pure component), `ConfirmDialog` (names the item), `PageHeader`
  - `StatusBadge` (the content lifecycle's 5 states, with plain labels: "Draft", "Waiting for approval", "Scheduled", "On website", "Archived")
- **Exposure guard:** until Phase 2 adds auth, `proxy.ts` returns **404 for `/admin/*` when `VERCEL_ENV === 'production'`**. A unit test covers this, and Phase 2 removes the guard.

### 3.7 Public placeholder
- `src/app/(public)/layout.tsx` + `page.tsx`: a minimal accessible page using the fallback theme, with landmarks, a skip link and one `h1`. It exists so the CSP, theme injection, axe and Lighthouse have a real public route. Templates arrive in Phase 3.
- `robots.ts` disallows everything while `seo.indexable` is false, which is the fallback value.

### 3.8 Quality gates
- **ESLint (flat config):**
  - `next/core-web-vitals`, `typescript-eslint` strict-type-checked, `jsx-a11y`
  - `no-restricted-imports`:
    - `@/lib/supabase/admin` is allowed only under `src/app/api/cron/**`, `src/app/api/webhooks/**` and `scripts/**`
    - `@supabase/auth-helpers-*` is banned
  - `no-restricted-syntax`: bans the `dangerouslySetInnerHTML` JSX attribute, with an allow-listed exception only for JSON-LD in a future `JsonLd` component
  - `@typescript-eslint/no-explicit-any`: error
- **Prettier** with the Tailwind plugin.
- **`scripts/check-school-values.mjs`** (MP §3.1): fails on `ac.ug`, `sc.ug`, `+256` or hex colours anywhere under `src/`, except:
  - `src/features/templates/**`
  - `src/app/admin/admin-tokens.css`
  - `src/features/cms/settings/fallback.ts`
  - test fixtures
- **Husky pre-commit** runs lint-staged (eslint --fix, prettier) and `gitleaks protect --staged` if gitleaks is installed. Otherwise it prints a warning, because CI is the hard gate.
- **Vitest** (`npm run test`): jsdom for components, node for libs; coverage via v8. The thresholds start at libs ≥ 90 % lines.
- **Playwright** (`npm run e2e`):
  - runs against `next build && next start`
  - projects: chromium desktop at 1280 px, and mobile Android emulation (Pixel 7) plus a fixed 360 px viewport
  - an axe scan on every visited page with WCAG 2.2 AA tags; any violation fails
  - `--trace off` by default

### 3.9 CI (`.github/workflows/ci.yml`)
Runs on PRs and `main`, with Node 22 and an npm cache. Jobs:
1. `install`, then in parallel: `typecheck`, `lint`, `check-school-values`, `unit`
2. `build` (dummy env values; secret-shaped values are fake)
3. `e2e` (Playwright, uploads screenshots and the report as artefacts)
4. `security`:
   - `npm audit --audit-level=high`
   - a dedicated step that **fails on any** advisory for `next`, `react`, `react-dom` or `react-server-dom-*` (MP §2.2)
   - `gitleaks/gitleaks-action` over the PR diff

Also: Renovate config (`renovate.json`) and a `CODEOWNERS` placeholder.

> Pushing `.github/workflows/*` needs the GitHub token to have the `workflow` scope. If the push is refused, I'll keep the workflow file in the branch and tell you. You would then add it through the GitHub UI or grant the scope.

### 3.10 Docs
- `docs/adr/000-stack.md`: the stack, the pins and why (React 19.2.x, TS 5.9), Cache Components, the CSP decision P1-A, the single-tenant model.
- `docs/adr/001-threat-model.md`: assets, actors, trust boundaries and a diagram; MP §7.1 threats → mitigations → spec section → phase → test. Includes D5, D6 and D13.
- `CLAUDE.md`: new gotchas (CSP/nonce rendering, TS pin, Playwright browser path).
- `docs/plan/progress.md` updated.
- `docs/admin-guide/`: no user-facing feature yet, so only a `README.md` index skeleton. That's stated in the Definition of Done report, not fudged.

## 4. Tests written in this phase

| Test | Type |
|---|---|
| `env` — missing, malformed and secret-prefixed-public vars rejected | unit |
| `csp` — the directive set; the nonce present in `script-src` and `style-src`; no `unsafe-inline`/`unsafe-eval` | unit |
| `contrast` — known WCAG pairs (e.g. #777 on #fff = 4.48) | unit |
| `oklch` / `suggest` — the suggestion always reaches ≥ 4.5:1 and keeps the hue | unit (property-based with `fast-check`) |
| `build-theme-vars` — snapshot for the fallback; `-fg` picks the higher-contrast ink | unit |
| `admin-tokens` — cyan is never used as a text colour token | unit |
| `proxy` — CSP header set; `/admin` 404 in production env; no-store on admin | unit |
| `check-school-values` — catches `+256`, `ac.ug` and hex; respects the allow-list | unit |
| Public page — 200, security headers present, one h1, skip link works, axe clean, theme vars present in a nonced style | E2E |
| Admin shell — 15 sections visible, drawer at 360 px, keyboard navigation through the sidebar, focus visible, axe clean | E2E |
| No CSP violations on either page (listens for `securitypolicyviolation`) | E2E |
| Screenshots at 360 px and 1280 px of `/` and `/admin/overview` | E2E artefact |

## 5. Definition of Done — how each item is evidenced

| DoD item | Phase 1 evidence |
|---|---|
| migrations applied to a fresh DB | **N/A in Phase 1** (no DB until Phase 2) |
| RLS + pgTAP pass | **N/A** (Phase 2) |
| Zod schemas shared client/server | the `SiteSettings` schema imported by both a server component and a client test |
| every action calls `requirePermission` | **N/A** (no actions); the ESLint rule for it lands in Phase 2 |
| unit + integration tests pass | Vitest output |
| Playwright E2E + axe pass | Playwright report + screenshots |
| typecheck / lint / build clean | command output |
| audit log entries | **N/A** (Phase 2) |
| admin-guide pages | index skeleton only; no user-facing feature yet |
| progress.md updated | diff |
| no TODOs without an issue link | `grep -rn TODO src` output |

## 6. Branch & commits
- Branch `feat/phase-01-foundation` → PR into `main` with the DoD checklist.
- Commits (Conventional Commits): scaffold → config/env → security headers → design system → theme tokens → admin shell → tests → CI → docs.

## 7. Decisions needed from you

| ID | Decision | My recommendation |
|---|---|---|
| **P1-A** | CSP: nonce everywhere (Option 1) vs hash-based on public routes (Option 2) | Option 1 now; revisit in Phase 14 |
| **P1-B** | React 19.2.9 (MP literal) vs 19.3.1 (latest) | 19.2.9; update MP/CLAUDE.md if you prefer 19.3 |
| P1-C | Is the 404 guard on `/admin` in production until Phase 2 acceptable? | Yes |

## 8. Out of scope for Phase 1
Supabase clients, auth, DB, permissions (Phase 2) · templates (Phase 3) · any CMS feature (Phase 4+).
