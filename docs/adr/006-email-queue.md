# ADR-006 — Email queue and cron dispatch

- **Status:** Accepted (Phase 2: schema and RLS). Sending is built in Phases 11–12; retries and monitoring are hardened in Phase 14. Spec decision D8, spec §1.11 and §4.8.

## Context

Applicants, enquirers and staff receive transactional email: acknowledgements, status changes and alerts. Three constraints shape how it is sent:

- Public submissions run as **anon**. Anon must not be able to read or update delivery state.
- Sending through Resend needs a server secret, and updating delivery state needs the Supabase **secret key**. CLAUDE.md allows that key only in `app/api/cron/*`, `app/api/webhooks/*` and `scripts/`.
- A Resend outage or a slow response must not fail, or slow down, the form submission that caused the email.

## Decision

Email is an **outbox**: writing the row and sending it are separate steps.

1. **Queue.** The security-definer RPC that owns the event inserts an `email_messages` row in the same transaction as the event, for example `submit_application` (Phase 12) or `submit_enquiry` (Phase 11). The row holds the template key and the props the template needs, with no free-text personal data beyond the needed fields. If the event rolls back, so does the email.
2. **Dispatch.** `after()` pokes `POST /api/cron/email-dispatch` (`CRON_SECRET`) so the email normally goes out within seconds. A Vercel cron runs the same route every 5 minutes as a sweep. Each run sends up to 50 due rows, checks `email_suppressions` first, and retries failures with a backoff of `2^attempts × 1 min`, up to 6 attempts.
3. **Delivery status.** `POST /api/webhooks/resend` (Svix signature) moves rows to `delivered`, `bounced` or `complained`. A bounce or complaint adds the address's hash to `email_suppressions`.
4. **Retention.** The retention cron purges `email_messages` after the school's configured period (Q5).

**Access (migration `20261123001200_email`):**

- No role can insert, update or delete through the API. There are no write policies, and anon has no grants.
- Staff can read a message only when they can read the record it belongs to: `admissions.view` plus MFA for applications, `enquiries.view` plus MFA for enquiries, or `settings.manage`.
- The suppression list is visible to `settings.manage` only, and stores a SHA-256 hash, never the address.

**Not in this queue:** staff sign-in emails (invite, password reset). Supabase Auth sends those itself, through the project's custom SMTP. In production that SMTP is Resend, configured during provisioning (spec §7, Phase 15).

## Consequences

- The secret key stays inside `api/cron/*` and `api/webhooks/*`, as CLAUDE.md requires.
- A submission succeeds even while Resend is down; the email goes out on a later sweep.
- Every email has a status the admin screens can show (PRD §5.1, "configurable and monitored").
- Five-minute cron schedules need Vercel Pro (Q1). On a lower tier, the `after()` poke still sends immediately, but retries wait for the next available schedule.
- Phase 2 ships only the tables, indexes and RLS. pgTAP proves RLS is on (`00_rls_enabled`) and that anon can neither read (`10_anon_reads`) nor write (`11_anon_writes`) either table. The staff read rules, the dispatch route, the webhook and their tests arrive with the first email-sending phase.
