# ADR-002 — One deployment per school (single-tenant)

- **Status:** Accepted. The decision is fixed by MASTER_PROMPT §1; the spec maps this ADR to Phase 1, and it was written down in Phase 2.
- **Context:** MASTER_PROMPT §1 and §13, spec §7 (provisioning), open questions Q1, Q2 and Q21.

## Context

Altrastate sells the same platform to many schools. There are two ways to host it:

- **Multi-tenant:** one deployment and one database for every school, with a `school_id` on every row and RLS that separates schools.
- **Single-tenant:** one codebase, deployed once per school.

## Decision

**One codebase, deployed once per school.** Each school gets its own Vercel project, its own Supabase project (database, Auth, Storage) and its own domain. There is no `school_id` column: separate Supabase projects keep schools apart.

## Consequences

- **Isolation.** A bug in an RLS policy can expose data only within one school, never across schools. RLS in this codebase is about roles inside a school.
- **The same build serves every school.** Names, contact details, colours and copy come from `site_settings` or environment variables, never from code. `npm run check:school-values` enforces this in CI.
- **Secrets are generated per school** at provisioning (spec §7): the Supabase keys, `CRON_SECRET`, `FORM_SIGNING_SECRET`, `IP_HASH_SALT` and the Vault secrets. One school's leak doesn't expose another.
- **Upgrades are a fleet operation** (MP §13):
  - Each school's Vercel project tracks a release branch or tag, not `main`.
  - Migrations are forward-only and backward-compatible across one release (expand, migrate, contract), because each school's app and database are upgraded separately.
  - The fleet-upgrade workflow backs up each school, migrates, promotes and smoke-tests it, and stops at the first failure.
- **Costs and limits are per school.** Each school pays for its own Vercel and Supabase plans (Q1). Supabase Auth's per-IP limits apply per project (ADR-008).
- **Data residency is per school.** Each school's personal data lives in its own Supabase project and region. There is no African region, hence the DPPA s.19 notice and the region probe (Q21).
- **Ownership can differ per school.** Accounts are Altrastate-managed, with the school as the billing contact (Q2, provisional). A school can be handed its own projects without untangling anyone else's data.
- **Cross-school features need deliberate work.** Fleet-wide reporting, for example, would need an explicit export from each school. None is in scope.

## Alternative considered

**Multi-tenant (`school_id` + tenant RLS).** It is cheaper to run and needs one upgrade instead of N. It was not chosen:

- One wrong policy, or one missed `school_id` filter, would expose every school's admissions data, including children's personal data.
- Per-school domains, residency, ownership handover and plan tiers would all become features of a shared system, rather than properties of separate projects.
