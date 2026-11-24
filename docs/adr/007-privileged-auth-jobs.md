# ADR-007 — Privileged auth operations as audited jobs

- **Status:** Accepted (Phase 2; decision P2-B / Q12). Spec decision D13.

## Context

Inviting staff (`auth.admin.inviteUserByEmail`) and ending another user's sessions need the Supabase **secret key**. CLAUDE.md allows that key only in `app/api/cron/*`, `app/api/webhooks/*` and `scripts/`, never in a request path.

## Decision

A two-step job:

1. The Server Action, as the signed-in user, inserts a row into `auth_admin_jobs`. RLS requires `users.manage`, and a trigger runs the **escalation check** in SQL: you cannot invite into, or act on, a role whose permissions you don't hold. `platform_support` can never be granted this way.
2. The action calls `POST /api/webhooks/internal/auth-admin` server-to-server, with `CRON_SECRET` compared in constant time.
3. The route re-reads the job: it must be pending, under 60 s old, and its requester must **still** hold `users.manage` (`user_has_permission`). Only then does it call `auth.admin.*`, then record the job outcome and an audit entry.

Supported operations:

- `invite`: invite, then assign roles
- `sign_out`: `revoke_user_sessions` deletes the user's sessions and refresh tokens. Their access tokens die within `jwt_expiry`, and `has_permission()` already refuses deactivated accounts immediately.

`resend_invite` arrives with the users screen in Phase 13.

## Consequences

- A leaked `CRON_SECRET` alone cannot invite or sign anyone out: there must be a fresh job created through RLS by an authorised user.
- Tested by `src/features/users/__tests__/auth-admin.int.test.ts`: end-to-end invite with the email in Mailpit, wrong secret, unknown job, expired job, session revocation, and escalation at job creation.
