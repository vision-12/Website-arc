# Phase 2 — Database, auth, RBAC & security foundation (plan)

**Status:** awaiting approval. Nothing in this file has been built yet.
**Inputs:**
- MASTER_PROMPT §2.3–2.5, §6, §7 and §12 (Phase 2 prompt)
- Spec §1, §2, §3, §4.0, §4.4, §4.7, §4.8 and §8.2
- Spec decisions D1–D3, D5, D7, D9, D10 and D13
- ADR-000 and ADR-001

**Depends on:** PR #1 (Phase 1) being merged. This branch is stacked on it.

## 1. Goal

A real Supabase database behind the Phase 1 shell:
- every core table, with RLS proven by pgTAP tests that are written first and shown failing
- the single permission path, `has_permission()` → `requirePermission()`
- invite-only authentication: login, password reset, accepting an invite, optional TOTP MFA
- `proxy.ts` session refresh with `getClaims()`
- the Supabase clients with the import guard
- storage buckets and policies
- an append-only audit log
- the security plumbing later phases rely on: submission tickets, rate limiting, privileged-auth jobs

After Phase 2, the admin area requires a login and shows each user only the sections their role permits. The Phase 1 production 404 guard is removed.

## 2. Decisions needed

| ID | Decision | Recommendation |
|---|---|---|
| **P2-A** | **The schema scope in Phase 2.** MP §7.3 requires Phase 2 tests on applications, admission notes, enquiries, drafts and `submit_application`, but MP §12 schedules the admissions schema for Phase 12a and enquiries for Phase 11. Those tests can't exist without the tables. | **Schema-first:** Phase 2 migrates the security-sensitive tables of the approved spec §1, with full RLS and triggers — RBAC, settings, audit, `pages` as the reference content table, enquiries, and the admissions core: applications, medical, documents, notes, status history, statuses, forms and intakes. No UI or actions for these yet. The other content tables (news, events, …) arrive with their modules, using the same LC template so they are RLS-tested on arrival. `submit_application`'s "rejects a client-supplied status/reference" test needs the RPC, which is built in Phase 12a; Phase 2 ships the test as a pgTAP `todo` that Phase 12a must turn green, so it can't be skipped. |
| **P2-B** | **D13 (Q12): inviting users and revoking sessions need the secret key.** | Adopt D13: the Server Action writes an `auth_admin_jobs` row (RLS + escalation check in SQL), then calls `POST /api/webhooks/internal/auth-admin` server-to-server with `CRON_SECRET`; the route re-validates the job and calls `auth.admin.*`. The secret key stays inside `api/webhooks/*`. |
| **P2-C** | **Q20: the Content Editor's scope** (pages, news, resources, gallery; not academics or staff) | Keep as spec §2.5. It's seed data and easy to change later. |
| **P2-D** | **Where the RLS tests run.** This environment can't pull the Supabase Docker images (Docker Hub and ECR rate-limit anonymous pulls from the shared network). GitHub's CI runners can. | Run **CI on the real Supabase stack** (`supabase start` → `db reset` → `test db`) as the authoritative gate. **Locally**, run the same migrations and pgTAP files on Ubuntu's PostgreSQL 16 + pgTAP with a small shim for Supabase's `auth`, `storage` and `vault` schemas (`supabase/tests/shim/`, test-only, never deployed). If Docker pulls start working, local runs use the real stack too. |
| P2-E | MFA required for admins by default? (MP §6 recommends it for Super Admin and Admissions Officer) | Seed `features.mfaRequiredForAdmins = false`, but **always require AAL2 for `super_admin` and `admissions_officer`** through a role flag (`roles.requires_mfa`), as MP §6 recommends. Schools can extend it to every role in settings. |

## 3. Migrations (`supabase/migrations/`, forward-only, one concern each)

| # | Migration | Contents |
|---|---|---|
| 01 | `foundation` | schemas `private` and `extensions`; extensions `citext`, `pgcrypto`, `pg_trgm`; global anon revokes (spec §3.0); `private.touch_updated_at`; `private.forbid_update_delete` |
| 02 | `enums` | all spec §1.0 enums |
| 03 | `rbac` | `profiles`, `roles` (+ `requires_mfa`), `permissions`, `role_permissions`, `user_roles`, `support_access_grants`; `public.has_permission()`; `private.mfa_satisfied()`; triggers: `on_auth_user_created`, `sync_mfa_enrolled`, `guard_role_grant`, `guard_role_permission_change`, `guard_last_super_admin`, `profile_update_guard`; RLS per spec §3.5 |
| 04 | `audit` | `activity_logs` (append-only), `public.log_activity()`, `private.audit_sensitive_change()` triggers on RBAC and settings tables; RLS per spec §3.8 |
| 05 | `settings` | `site_settings`, `site_settings_private`, `redirects`, `content_drafts`; `public.update_site_settings(section, value, version)` with per-section permission; RLS per spec §3.4 |
| 06 | `security_infra` | Vault-backed `private.secret(name)`; `private.verify_ticket` (D5); `private.rate_limit_hit` + `public.rate_limit_check_auth` (D9); `private.submission_tickets_used`; `retention_runs` |
| 07 | `auth_admin_jobs` | the table + escalation trigger (D13) |
| 08 | `lifecycle` | `private.content_lifecycle_guard(module)` (§2.3 state machine, version bump, redirects on slug change); the `apply_lc_policies` migration helper |
| 09 | `media_pages` | `media_assets` (column grants for anon), `media_usages` + alt-text trigger, `pages` (+ path trigger), FTS column (spec §1.4) |
| 10 | `enquiries` | `contact_messages`, `enquiry_notes`; RLS per spec §3.6 (no anon insert; `submit_enquiry` arrives in Phase 11) |
| 11 | `admissions_core` | `admission_forms`, `admission_form_versions`, `admission_intakes`, `admission_intake_classes`, `admission_statuses`, `applications`, `application_medical`, `application_upload_sessions`, `application_documents`, `admission_status_history`, `admission_notes`, `admission_info_requests`; `private.application_ref_seq` + reference generator (Feistel + Crockford + Luhn mod 32, spec §1.10); RLS per spec §3.7 |
| 12 | `email` | `email_messages`, `email_suppressions` (+ RLS) |
| 13 | `storage` | buckets `media`, `resources`, `admission-documents` (limits + MIME types); staff policies per spec §3.9. The anon slot policies come with Phase 12c, because they depend on the upload-slot RPCs. |

Seeds:
- `supabase/seed.sql` (local only): the 8 roles, 69 permissions and the role matrix from spec §2.5; the 7 admission statuses; dev `site_settings` (neutral); **one test user per role** with a known local-only password; `vault` test secrets.
- `supabase/seed/production.sql`: the same reference data without users. It is used by provisioning (Phase 15).

`npm run db:types` generates `src/types/database.ts`. CI fails if the committed types are stale.

## 4. Application code

| Area | Files | Notes |
|---|---|---|
| Clients | `src/lib/supabase/server.ts` | `createClient()` is async and cookie-based (`@supabase/ssr`, `await cookies()`); `createPublicClient()` is cookie-less and the only client allowed in `'use cache'` (spec D7). |
| | `browser.ts`, `admin.ts` | `admin.ts` is the secret key, `server-only`. The ESLint guard already exists from Phase 1. |
| Proxy | `src/lib/supabase/proxy.ts` + `src/proxy.ts` | session refresh via `getClaims()` (MP §2.4), merged with the existing CSP code. Unauthenticated `/admin/*` → `/login?next=…`. The Phase 1 production guard is removed. |
| Auth guard | `src/lib/auth/require-permission.ts`, `errors.ts` | `requireUser()`, `requirePermission(p)`, and `getPermissions()` (request-memoised with React `cache()`); typed `UnauthenticatedError`, `ForbiddenError`, `MfaRequiredError`; `platform_support` sensitive-access audit (spec §2.4) |
| Action pipeline | `src/lib/actions/{result,define}.ts` | `Result<T>`, the `ErrorCode` map, `defineAction` / `definePublicAction` (spec §4.0), Postgres error → code mapping. Used by the auth actions now. |
| Audit | `src/lib/audit/{log,redact}.ts` | `logActivity()` via the RPC; redaction of PII keys; IP hashing (D10) |
| Rate limit | `src/lib/security/rate-limit.ts` | calls `rate_limit_check_auth` |
| Settings | `src/features/cms/settings/queries.ts` | `getSiteSettings()` reads the DB through `createPublicClient()`, falling back to the neutral fallback only when the row doesn't exist yet (fresh install). |
| Auth UI | `src/app/(auth)/{login,forgot-password,reset-password,accept-invite,mfa}` + `src/features/auth/{schema,actions}.ts` | spec §4.7: generic errors, paste allowed, `autocomplete` attributes, rate limits, audit (`auth.login`, `auth.login_failed_burst`), `?next=` same-origin only |
| Admin shell | `src/app/admin/layout.tsx` | real user and permissions → `visibleSections(perms)`; user menu with name and a working sign-out; an MFA nudge when the role requires it and the user isn't enrolled |
| Account | `src/app/admin/account` | change name, change password, enrol or remove TOTP (QR code + manual key) |
| D13 | `src/app/api/webhooks/internal/auth-admin/route.ts` + `src/features/users/admin-jobs.ts` | job runner (invite, resend invite, sign-out). The Phase 13 UI will call it; Phase 2 proves it with integration tests and the first-super-admin bootstrap script. |
| Scripts | `scripts/bootstrap-super-admin.ts` | invites the first Super Administrator, for provisioning step 12 |

## 5. Tests (security tests written first; the red run is captured as evidence)

**pgTAP (`supabase/tests/`)**, per spec §8.2:

| File | Asserts |
|---|---|
| `00_rls_enabled` | RLS is on for every table |
| `01_policy_uid_initplan` | `auth.uid()` / `auth.jwt()` only inside `(select …)` |
| `02_definer_search_path` | every definer function sets `search_path=''` |
| `03_policy_text` | the LC template matches on `pages` |
| `10_anon_reads` | anon can't read drafts, notes, applications, medical, documents, enquiries, logs, profiles, user_roles, private settings or email; can read published pages |
| `11_anon_writes` | anon can't insert, update or delete on any table |
| `20_role_isolation` | per spec §8.2, against the PRD roles |
| `21_deactivated` | a deactivated user reads nothing and `has_permission` is false for every key |
| `22_escalation` | no self-grant; a grantor can't grant permissions they lack; system roles are immutable; last super admin |
| `23_mfa` | an aal1 user is blocked from admissions/enquiries when MFA is required; `requires_mfa` roles always need aal2 |
| `24_support_access` | grant window, expiry, revoke, only super admin grants |
| `30_lifecycle` | `pages` transitions per role, with approval on and off; version bump; slug-change redirect |
| `31_append_only` | activity_logs, status history and notes can't be updated or deleted by anyone |
| `40_submit_application` | **todo** (Phase 12a) |
| `41_reference` | format, Luhn validity, uniqueness over 100k, non-sequential |
| `44_storage_staff` | content editor can't read admission documents; admissions officer can |
| `45_auth_admin_jobs` | escalation is blocked at job creation |

Each test file is committed and run **before** its migration exists. The failing output is pasted into `docs/plan/evidence/phase-02/red.txt`, then the migration is added and the green run captured (MP Phase 2: "prove each RLS test fails before the policy exists").

**Unit (Vitest):**
- `requirePermission` with a mocked client: unauthenticated, forbidden, MFA, and support audit
- `defineAction` error mapping (no raw messages leak)
- redaction
- `?next=` sanitising
- the reference-number TS mirror: Luhn and normalisation

**Integration (Vitest against local Supabase or the PG shim):** login rate limit and generic errors; invite job lifecycle; deactivation revokes sessions; `update_site_settings` per-section permission.

**E2E (Playwright + axe):**
- `/admin` redirects to login when signed out
- login (wrong password shows the generic error; correct password lands on the overview)
- the sidebar per role, for each of the 7 seeded users
- MFA enrolment and challenge with a TOTP generated in the test
- a deactivated user is signed out on their next request
- forgot-password and reset via the local mail catcher (Mailpit)
- every page axe-clean and CSP-clean; screenshots at 360 px and 1280 px of login, MFA and the sidebar for two roles

## 6. CI changes
A new `database` job:
1. `supabase start`
2. `supabase db reset` (migrations + seed)
3. `supabase test db`
4. `supabase db lint`
5. a types-drift check
6. the Supabase Security and Performance Advisor equivalents (`supabase db lint` / splinter checks)

The E2E job runs against the local stack. Docker layer caching keeps it reasonably fast.

## 7. Docs
- ADR-003 (submission tickets), ADR-006 (email queue), ADR-007 (D13), ADR-008 (rate limiting), ADR-014 (entity naming)
- `docs/runbooks/local-dev.md`
- `docs/admin-guide/logging-in.md` (sign in, reset password, set up the authenticator app)
- `CLAUDE.md` gotchas and `progress.md`

## 8. Definition of Done evidence

Every MP §12 item applies this phase, so each one is reported with command output:
- migrations applied cleanly to a fresh DB
- RLS and pgTAP red → green
- schemas shared
- every action calls `requirePermission`, enforced by a new ESLint rule over `features/**/actions.ts`
- unit, integration and E2E
- typecheck, lint and build
- audit entries for logins and role changes
- the admin-guide page
- progress updated
- no TODOs

## 9. Out of scope
- the users and roles management UI (Phase 13; the SQL rules and jobs are built now)
- content module UIs (Phase 4+)
- `submit_enquiry` / `submit_application` RPCs (Phases 11 and 12)
- the anon upload-slot storage policies (Phase 12c)
