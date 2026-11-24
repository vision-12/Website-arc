# ADR-003 — Submission tickets for public RPCs

- **Status:** Accepted (Phase 2). Spec decision D5.

## Context

Public writes (enquiries, applications, and login and reset throttling) go through `security definer` RPCs callable with the **publishable** key, which is public by design. Without more, anyone could call those RPCs directly and skip the app's anti-abuse layers (BotID, honeypot, time-to-submit, MP §7.6).

## Decision

A public RPC accepts a call only with a **server-minted ticket**:

```
mac = HMAC-SHA256(FORM_SIGNING_SECRET, purpose "." sha256(payload) "." issuedAt "." ipHash)
```

- The signer is `src/lib/security/ticket.ts`. The verifier is `private.verify_ticket()`, which reads the same secret from Supabase Vault (`form_signing_secret`).
- A ticket is valid for 120 s and is **single use** (`private.submission_tickets_used`).
- It binds the purpose, the exact payload string and the client's IP hash.
- The Server Action mints the ticket only after its own checks pass.

## Consequences

- `FORM_SIGNING_SECRET` must be identical in the Vercel env and in Vault (provisioning sets both, spec §7.2).
- Rotating the secret requires changing both at once; in-flight tickets (≤ 120 s) fail with a retryable message.
- Tested by `src/lib/security/__tests__/ticket.test.ts` (format) and `tickets.int.test.ts` (TS signer ⇄ SQL verifier: valid, tampered, replayed, expired).
