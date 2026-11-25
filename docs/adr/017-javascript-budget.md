# ADR-017 — First-load JavaScript budget (Q27)

- **Status:** **Accepted** (25 Nov 2026). Altrastate accepted the recommendation.
- **Context:** MP §10 ("first-load client JS ≤ 120 KB gzipped on public routes"); MP §2 (Next.js 16 and React 19.2.x are pinned); Phase 3 measurement (`docs/plan/phase-03.md` §11); ADR-016 §9; open question Q15 (admissions route).

## Context

Phase 3 measured the homepage on the production build:

| Part                                                                                                                | Gzipped                               |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Next.js 16 + React 19 runtime: the files every page loads, listed as `rootMainFiles` in `.next/build-manifest.json` | 132 KB                                |
| Our own code (template islands)                                                                                     | 15 KB, down from 25 KB during Phase 3 |
| **Total**                                                                                                           | **147 KB**                            |

The framework alone is larger than the 120 KB budget. The App Router can't run a page without its runtime, and the stack is pinned by MP §2. **No change to our own code can meet the budget as written.**

## Options

1. **Budget our own code on top of the framework (recommended).** Public routes may load the framework runtime plus at most **20 KB gzipped** of our own JavaScript. The framework part is recorded on every E2E run, so a jump (for example after an upgrade) is visible in review.
2. **Keep 120 KB and change the stack on public pages**, for example a static, no-runtime public site. That means a second rendering stack, losing PPR, the shared template engine and soft navigation. It contradicts MP §2.
3. **Measure Brotli instead of gzip.** Vercel serves Brotli, about 15 % smaller. That only moves the line: the framework would still use most of the budget.

## Decision

**Option 1.** On public routes, first-load JavaScript is the framework runtime plus at most 20 KB gzipped of app code.

## Consequences

- **E2E** (`e2e/budgets.spec.ts`) separates framework files (from the build manifest) from our own and fails if ours exceed 20 KB on the homepage. It annotates every run with the total, framework and app sizes.
- **Islands stay small** (CLAUDE.md, ADR-016 §9):
  - no `tailwind-merge` or icon runtimes in public islands
  - admin-only helpers stay in the admin layout
- **The admissions form exception** (Q15, Phase 12) is restated the same way when that phase starts: framework plus an app allowance for the form.
- **Lighthouse CI** (Phase 14) reports the same split.
