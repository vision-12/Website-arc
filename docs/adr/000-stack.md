# ADR-000 — Stack, version pins, and CSP with static shells

- **Status:** Accepted (Phase 1, 23 Nov 2026)
- **Context:** MASTER_PROMPT §2, §4, §7.5 and §10; spec decisions P1-A and P1-B.

## Decision 1 — Stack and pins

| Layer       | Choice                                                                                                          | Pin / note                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | Next.js App Router, Turbopack, `cacheComponents: true`, `partialPrefetching: true`, `typedRoutes: true`         | `next` 16.4.6                                                                                                                                                                             |
| UI runtime  | React                                                                                                           | **19.2.9**. MP §2.2 says "latest patched 19.2.x". 19.3.x exists but is held back by Renovate until this ADR is revised.                                                                   |
| Language    | TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`                                     | **5.9.3**. typescript-eslint 8 supports `<6.1`; TS 7 is out but not yet supported by the lint toolchain.                                                                                  |
| Styling     | Tailwind CSS v4 (`@theme inline`, no config file), `tw-animate-css`                                             | 4.3.x                                                                                                                                                                                     |
| Components  | shadcn/ui (new-york, CSS variables) on the unified `radix-ui` package                                           | Components are added from shadcn source by hand. The registry host was blocked in the build environment, and `components.json` is committed so the CLI works where the host is reachable. |
| Toasts      | **Radix Toast** (own ~80-line wrapper), _not_ sonner                                                            | sonner injects an un-nonced `<style>` element at import time, with no opt-out. That would violate the CSP on every admin page.                                                            |
| Validation  | Zod 4                                                                                                           |                                                                                                                                                                                           |
| Tests       | Vitest 5 (+ fast-check property tests), Playwright **1.63** + `@axe-core/playwright`                            | Playwright and `playwright-core` are pinned to 1.63 to match the browser image used here; CI installs its own browsers.                                                                   |
| Lint/format | ESLint 9 flat config (`eslint-config-next` 16, `typescript-eslint` strict-type-checked, `jsx-a11y`), Prettier 3 | ESLint 10 exists; `eslint-config-next` is validated against 9.                                                                                                                            |
| Hooks       | Husky 9 + lint-staged; gitleaks when installed locally, always in CI                                            |                                                                                                                                                                                           |
| Deployment  | Vercel (one project per school) + Supabase (one project per school)                                             | single-tenant model, MP §1                                                                                                                                                                |

## Decision 2 — CSP nonces _and_ prerendered static shells (supersedes P1-A's "Option 1" trade-off)

**Problem.** MP §7.5 requires a nonce-based CSP. MP §10 wants static shells with cached data. A nonce must differ on every request, while a prerendered shell is identical for everyone.

**What we measured** (Next 16.4.6, production build, Chromium):

1. With `'strict-dynamic'` in `script-src`, the external chunk `<script src>` tags in the prerendered shell have **no nonce**, so they are blocked and hydration fails. _Broken._
2. Without `'strict-dynamic'`, `'self'` allows those external chunks. Next stamps the per-request nonce on its **inline** bootstrap scripts, **but only when the route has a dynamic part**. A fully static (○) route is served from disk with un-nonced inline scripts. _Broken on static routes._
3. React's prerendered shell contains one constant inline script, `requestAnimationFrame(function(){$RT=performance.now()});`, which never receives a nonce.
4. React hoists `<style precedence>` elements and **drops their nonce**, so a nonced inline theme `<style>` doesn't work.

**Decision.**

- `script-src 'self' 'nonce-…' 'sha256-<React $RT script>'`, **without** `'strict-dynamic'`. Same-origin scripts are trustworthy here: user uploads live on the Supabase storage origin, never on the site origin.
- The root layout renders a tiny `<RequestBoundary>` (`await connection()` inside `<Suspense>`, renders nothing). Every route is therefore **partially prerendered (◐)**: the HTML shell is still prerendered and cached, Next resumes it per request, and its inline scripts get the request's nonce.
- The school theme is **not** an inline `<style>`. It is the same-origin stylesheet `/theme.css?v=<site_settings.version>`, linked from the cached layout. That makes it render-blocking (no flash of unthemed content), CSP-clean (`style-src-elem 'self'`), and `immutable` per version. A settings save bumps the version and the `site-settings` cache tag re-renders the link. **This amends spec §6.2.**
- `style-src-attr 'unsafe-inline'` is allowed because React and `next/image` emit `style=""` attributes. Attribute styles can't load resources or run script.
- Runtime-injected `<style>` elements (Radix's scroll lock, via `react-style-singleton`) get the nonce through `get-nonce`. `src/components/shared/style-nonce.tsx` reads it from Next's `<script nonce>` in the DOM, so no request data is needed in the layout.
- Every E2E test fails on **any** CSP violation reported by the browser (`e2e/fixtures.ts`). A Next or React upgrade that changes this behaviour is caught immediately.

**Consequences.**

- Public pages keep prerendered shells and tag-cached data. MP §10's intent holds, and spec §5.0's "static shell + cached data" stands.
- If the `$RT` script text changes in a React upgrade, the hash must be updated in `src/lib/security/csp.ts`; the CSP-violation E2E check will flag it.
- Phase 14 will re-evaluate `'strict-dynamic'` if Next starts stamping nonces on prerendered external scripts.

## Decision 3 — Admin area exposure before authentication (P1-C)

Until Phase 2 adds authentication, `proxy.ts` returns 404 for `/admin/*` when `VERCEL_ENV === 'production'`. This is unit-tested, and Phase 2 removes it.

## Amendment — Phase 2 findings (24 Nov 2026)

Measured while building authentication. Each item has a test that fails if it regresses.

1. **User-scoped Supabase client is request-time only.** Under Cache Components, `cookies()` is "runtime data" that Next may still prerender (runtime prefetch). The supabase-js auth client reads the clock on start-up, which Next refuses during prerendering. `createClient()` therefore awaits `connection()` first. User data must never be prerendered anyway (MP §2.5).
2. **The public (cached) client is PostgREST only.** The full supabase-js client starts background auth timers that outlive a `'use cache'` scope. `createPublicClient()` is a plain `PostgrestClient` with the publishable key.
3. **Forms are disabled until hydration.** On partially prerendered routes, a Server Action submitted _before_ React hydrates is handled as a native form post. The response contains only the streamed dynamic segments: no page shell and no form state. The visitor sees a blank or broken page. Every submit button is disabled until `useHydrated()` is true (`src/hooks/use-hydrated.ts`); e2e "cannot be submitted before the page is ready" holds the JS back to prove it.
   - **Consequence for the public site:** with JavaScript fully disabled, forms cannot be used. This is acceptable for the admin area. The public contact and admissions forms (Phases 11–12) must decide their no-JS behaviour explicitly; this was open question **Q26**, decided in ADR-015: JavaScript is required, with a `<noscript>` notice.
4. **Never put a form inside a `<Suspense>` that streams.** The prerendered fallback form is replaced when the real one streams in, wiping anything typed meanwhile. Pages render forms once and read query parameters in the browser (`useSearchParam`).
5. **Nonce for runtime-injected styles comes from inline scripts only.** The client runtime later inserts external chunk scripts that can carry a stale nonce (harmless to them under `'self'`). `StyleNonce` reads `script[nonce]:not([src])`.
6. **Hidden previous pages stay mounted.** Next keeps the previous route mounted, hidden, for instant back navigation. IDs must not collide across shells: the auth screens use `#auth-main`, the admin and public shells `#main-content`. Tests use role-based queries, which ignore hidden content.
7. **`forbidden()` status.** On partially prerendered admin routes, the shell has already streamed with 200 by the time a section's permission check runs. The section's content is withheld and replaced by the "no access" view, but the HTTP status stays 200. Authorisation does not depend on the status code; RLS and `requirePermission` are the boundary.
8. **A form's `action` stays a Server Action.** If `action` is a client function (for example a wrapper that validates first), React can't render the form progressively enhanced. It adds an inline form-replay script instead, and that script has no nonce in a prerendered shell, so the CSP blocks it. Browser-side checks run in `onSubmit` and cancel the submit when the input is invalid (`useClientCheck`); the E2E CSP guard caught this.
