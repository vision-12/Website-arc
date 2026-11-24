# ADR-008 — Rate limiting

- **Status:** Accepted (Phase 2). Spec decision D9.

## Decision

Rate limiting works in three layers:

1. **Vercel WAF rules** (per IP on `/login`, `/forgot-password`, `/contact`, `/admissions/*`), where the plan allows (Q1).
2. **App limiter in Postgres.** `private.rate_limit_hit()` uses fixed-window counters in an unlogged table, keyed by **HMAC-hashed** IP and email, never the raw values. It is called from ticket-gated RPCs, so the keys can't be forged by calling the RPC directly. Login and reset use `rate_limit_check_auth()`, which **returns** a decision (instead of raising) so that the first blocked attempt in a window is written to the audit log as `auth.login_burst` / `auth.reset_burst`.

   | Action         | Per IP        | Per email   |
   | -------------- | ------------- | ----------- |
   | Login          | 30 per 15 min | 10 per hour |
   | Password reset | 10 per hour   | 3 per hour  |

   The per-IP login limit is generous on purpose: a school office usually shares one public IP. _(This amends spec §4.7, which said 5 per 15 min.)_

3. **Supabase Auth's own limits are a backstop.** All sign-ins reach Auth from the **app server's** IP, so Auth's per-IP limits are effectively shared by the whole school. Its defaults (30 sign-ins per 5 min, 2 emails per hour) would lock out a busy office. Provisioning sets `sign_in_sign_ups = 600`, `token_verifications = 600`, `token_refresh = 1500` and `email_sent = 100` (`supabase/config.toml` for local; the Management API for production, spec §7.2 step 3).

## Notes

- The client IP is the first `X-Forwarded-For` hop. On Vercel this is set by the edge from the real connection, not from a client-supplied header.
- Generic messages only: "Email or password is incorrect" / "If an account exists, we have sent a link".
- Tested by `tickets.int.test.ts` (the 11th attempt is refused; the burst is audited once) and the E2E sign-in suite.
